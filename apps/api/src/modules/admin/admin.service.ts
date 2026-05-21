import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CryptoService } from '../../core/crypto/crypto.service';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ApproveDoctorDto, RejectDoctorDto } from './dto/approve-doctor.dto';
import { CreateCouponDto, UpdateCouponDto } from './dto/manage-coupon.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { NotifChannel, NotifType } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Dashboard stats ───────────────────────────────────────────────────────

  async getStats() {
    const [
      totalUsers,
      totalDoctors,
      totalPatients,
      pendingDoctors,
      totalBookings,
      confirmedBookings,
      completedBookings,
      totalRevenuePaise,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: 'DOCTOR' } }),
      this.prisma.user.count({ where: { role: 'PATIENT' } }),
      this.prisma.doctorProfile.count({ where: { verificationStatus: 'PENDING' } }),
      this.prisma.booking.count(),
      this.prisma.booking.count({ where: { status: 'CONFIRMED' } }),
      this.prisma.booking.count({ where: { status: 'COMPLETED' } }),
      this.prisma.doctorEarning.aggregate({ _sum: { grossAmountPaise: true } }),
    ]);

    return {
      users: { total: totalUsers, doctors: totalDoctors, patients: totalPatients },
      doctors: { pendingApproval: pendingDoctors },
      bookings: { total: totalBookings, confirmed: confirmedBookings, completed: completedBookings },
      revenue: { totalPaise: totalRevenuePaise._sum.grossAmountPaise ?? 0 },
    };
  }

  // ── Doctor approval ───────────────────────────────────────────────────────

  async approveDoctor(doctorUserId: string, actorId: string, dto: ApproveDoctorDto) {
    const profile = await this.prisma.doctorProfile.findUnique({ where: { userId: doctorUserId } });
    if (!profile) throw new NotFoundException('Doctor profile not found');
    if (profile.verificationStatus === 'APPROVED') {
      throw new ConflictException('Doctor is already approved');
    }

    await this.prisma.$transaction([
      this.prisma.doctorProfile.update({
        where: { userId: doctorUserId },
        data: { verificationStatus: 'APPROVED' },
      }),
      this.prisma.user.update({
        where: { id: doctorUserId },
        data: { status: 'APPROVED' },
      }),
    ]);

    await this.notifications.dispatch({
      userId: doctorUserId,
      type: NotifType.DOCTOR_APPROVED,
      title: 'Your account has been approved!',
      body: 'Congratulations! Your DocNear doctor account is now active. You can start setting up your availability.',
      channels: [NotifChannel.IN_APP, NotifChannel.EMAIL],
    });

    await this.audit.log({
      actorId,
      action: 'DOCTOR_APPROVED',
      resourceType: 'DoctorProfile',
      resourceId: profile.id,
      newValue: { verificationStatus: 'APPROVED', notes: dto.notes },
    });

    return { message: 'Doctor approved successfully' };
  }

  async rejectDoctor(doctorUserId: string, actorId: string, dto: RejectDoctorDto) {
    const profile = await this.prisma.doctorProfile.findUnique({ where: { userId: doctorUserId } });
    if (!profile) throw new NotFoundException('Doctor profile not found');
    if (profile.verificationStatus === 'REJECTED') {
      throw new ConflictException('Doctor is already rejected');
    }

    await this.prisma.$transaction([
      this.prisma.doctorProfile.update({
        where: { userId: doctorUserId },
        data: { verificationStatus: 'REJECTED' },
      }),
      this.prisma.user.update({
        where: { id: doctorUserId },
        data: { status: 'REJECTED' },
      }),
    ]);

    await this.notifications.dispatch({
      userId: doctorUserId,
      type: NotifType.DOCTOR_REJECTED,
      title: 'Account application not approved',
      body: dto.reason
        ? `Your application was not approved: ${dto.reason}`
        : 'Your application was not approved at this time. Please contact support.',
      channels: [NotifChannel.IN_APP, NotifChannel.EMAIL],
    });

    await this.audit.log({
      actorId,
      action: 'DOCTOR_REJECTED',
      resourceType: 'DoctorProfile',
      resourceId: profile.id,
      newValue: { verificationStatus: 'REJECTED', reason: dto.reason },
    });

    return { message: 'Doctor rejected' };
  }

  // ── User management ───────────────────────────────────────────────────────

  async listUsers(dto: ListUsersDto) {
    const { page, limit, role, status, search } = dto;
    const skip = (page - 1) * limit;

    // Search by email hash if search looks like an email; otherwise name prefix
    const where: Record<string, unknown> = {};
    if (role) where['role'] = role;
    if (status) where['status'] = status;
    if (search) {
      if (search.includes('@')) {
        where['emailHash'] = this.crypto.hashEmail(search);
      } else {
        where['OR'] = [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
        ];
      }
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
          emailVerified: true,
          avatarUrl: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async suspendUser(targetUserId: string, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.status === 'SUSPENDED') throw new ConflictException('User is already suspended');

    await this.prisma.user.update({
      where: { id: targetUserId },
      data: { status: 'SUSPENDED' },
    });

    await this.audit.log({
      actorId,
      action: 'USER_SUSPENDED',
      resourceType: 'User',
      resourceId: targetUserId,
    });

    return { message: 'User suspended' };
  }

  // ── Specialities CRUD ─────────────────────────────────────────────────────

  async listSpecialities() {
    return this.prisma.speciality.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async createSpeciality(data: { name: string; slug: string; description?: string; iconUrl?: string }) {
    const existing = await this.prisma.speciality.findUnique({ where: { slug: data.slug } });
    if (existing) throw new ConflictException('Speciality with this slug already exists');
    return this.prisma.speciality.create({ data: { id: randomUUID(), ...data } });
  }

  async updateSpeciality(id: string, data: { name?: string; isActive?: boolean; sortOrder?: number }) {
    const spec = await this.prisma.speciality.findUnique({ where: { id } });
    if (!spec) throw new NotFoundException('Speciality not found');
    return this.prisma.speciality.update({ where: { id }, data });
  }

  // ── Cities CRUD ───────────────────────────────────────────────────────────

  async listCities() {
    return this.prisma.city.findMany({ orderBy: { name: 'asc' } });
  }

  async updateCity(id: string, data: { isActive?: boolean }) {
    const city = await this.prisma.city.findUnique({ where: { id } });
    if (!city) throw new NotFoundException('City not found');
    return this.prisma.city.update({ where: { id }, data });
  }

  // ── Coupons CRUD ──────────────────────────────────────────────────────────

  async listCoupons() {
    return this.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createCoupon(dto: CreateCouponDto) {
    const existing = await this.prisma.coupon.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException('Coupon code already exists');
    return this.prisma.coupon.create({
      data: {
        id: randomUUID(),
        code: dto.code.toUpperCase(),
        type: dto.type,
        applicableTo: dto.applicableTo,
        value: dto.value,
        minOrderAmount: dto.minOrderAmount ?? 0,
        maxDiscount: dto.maxDiscount ?? null,
        usageLimit: dto.usageLimit ?? null,
        perUserLimit: dto.perUserLimit ?? 1,
        validFrom: new Date(dto.validFrom),
        validUntil: new Date(dto.validUntil),
      },
    });
  }

  async updateCoupon(id: string, dto: UpdateCouponDto) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) throw new NotFoundException('Coupon not found');
    return this.prisma.coupon.update({
      where: { id },
      data: {
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.validUntil && { validUntil: new Date(dto.validUntil) }),
        ...(dto.usageLimit !== undefined && { usageLimit: dto.usageLimit }),
      },
    });
  }

  // ── Audit logs ────────────────────────────────────────────────────────────

  async listAuditLogs(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count(),
    ]);
    return {
      data: logs,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── Pending doctor payouts ────────────────────────────────────────────────

  async listPendingPayouts() {
    const earnings = await this.prisma.doctorEarning.findMany({
      where: { isPaidOut: false },
      include: { doctor: { include: { user: true } } },
      orderBy: { createdAt: 'asc' },
    });

    // Group by doctor
    const byDoctor = new Map<string, { doctor: unknown; totalNetPaise: number }>();
    for (const e of earnings) {
      const key = e.doctorId;
      if (!byDoctor.has(key)) {
        byDoctor.set(key, { doctor: e.doctor, totalNetPaise: 0 });
      }
      byDoctor.get(key)!.totalNetPaise += e.netAmountPaise;
    }

    return Array.from(byDoctor.values());
  }

  async markPaidOut(doctorId: string, actorId: string) {
    const doctor = await this.prisma.doctorProfile.findUnique({ where: { id: doctorId } });
    if (!doctor) throw new NotFoundException('Doctor not found');

    const { count } = await this.prisma.doctorEarning.updateMany({
      where: { doctorId, isPaidOut: false },
      data: { isPaidOut: true, payoutId: `PAYOUT-${Date.now()}` },
    });

    if (count === 0) throw new BadRequestException('No pending earnings to pay out');

    await this.audit.log({
      actorId,
      action: 'PAYOUT_MARKED',
      resourceType: 'DoctorEarning',
      resourceId: doctorId,
      newValue: { count },
    });

    return { message: `Marked ${count} earnings as paid out` };
  }
}

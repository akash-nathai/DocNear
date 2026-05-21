import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { BookingStatus, CancelledBy, CouponType, Prisma, Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import { Redis } from 'ioredis';
import { REDIS_KEYS, SLOT_LOCK_TTL_SECONDS } from '../../common/constants';
import { PrismaService } from '../../core/database/prisma.service';
import { REDIS_CLIENT } from '../../core/redis/redis.constants';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ListBookingsDto } from './dto/list-bookings.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import {
  BOOKING_EXPIRY_QUEUE,
  BOOKING_PAYMENT_TIMEOUT_MS,
  BOOKING_REF_PREFIX,
} from './bookings.constants';
import type { BookingExpiryJobData } from './processors/booking-expiry.processor';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateBookingRef(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  return `${BOOKING_REF_PREFIX}-${date}-${rand.padEnd(6, '0')}`;
}

const CANCELLABLE_BY_PATIENT: BookingStatus[] = [
  BookingStatus.PENDING_PAYMENT,
  BookingStatus.CONFIRMED,
];

const CANCELLABLE_BY_DOCTOR: BookingStatus[] = [BookingStatus.CONFIRMED];

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectQueue(BOOKING_EXPIRY_QUEUE) private readonly expiryQueue: Queue,
  ) {}

  // ── Create ────────────────────────────────────────────────────────────────

  async createBooking(userId: string, dto: CreateBookingDto) {
    // 1. Require patient role + profile
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.role !== Role.PATIENT) {
      throw new ForbiddenException('Only patients can book consultations');
    }

    const patient = await this.prisma.patientProfile.findUnique({ where: { userId } });
    if (!patient) throw new ForbiddenException('Patient profile not found');

    // 2. Doctor lookup
    const doctor = await this.prisma.doctorProfile.findUnique({
      where: { slug: dto.doctorSlug },
    });
    if (!doctor || doctor.verificationStatus !== 'APPROVED') {
      throw new NotFoundException('Doctor not found');
    }

    // 3. Parse + validate slot datetime
    const slotDatetime = new Date(dto.slotDatetime);
    if (isNaN(slotDatetime.getTime())) {
      throw new BadRequestException('Invalid slotDatetime format');
    }
    if (slotDatetime <= new Date()) {
      throw new BadRequestException('Cannot book a slot in the past');
    }

    // 4. consultType + clinic validation
    if (dto.consultType === 'IN_CLINIC' && !dto.clinicId) {
      throw new BadRequestException('clinicId is required for IN_CLINIC consultations');
    }
    if (dto.clinicId) {
      const clinic = await this.prisma.clinic.findFirst({
        where: { id: dto.clinicId, doctorId: doctor.id, isActive: true },
      });
      if (!clinic) throw new NotFoundException('Clinic not found for this doctor');
    }

    // 5. Family member validation
    if (dto.familyMemberId) {
      const member = await this.prisma.familyMember.findFirst({
        where: { id: dto.familyMemberId, patientId: patient.id },
      });
      if (!member) throw new NotFoundException('Family member not found');
    }

    // 6. Acquire Redis slot lock (NX = only if not exists)
    const slotKey = REDIS_KEYS.slotLock(doctor.id, slotDatetime.toISOString());
    const bookingId = randomUUID();
    const lockAcquired = await this.redis.set(
      slotKey,
      bookingId,
      'EX',
      SLOT_LOCK_TTL_SECONDS,
      'NX',
    );
    if (!lockAcquired) {
      throw new ConflictException(
        'This slot is currently being booked by another patient. Please try again in a moment.',
      );
    }

    try {
      // 7. DB double-check (catches bookings confirmed before lock was acquired)
      const conflict = await this.prisma.booking.findFirst({
        where: {
          doctorId: doctor.id,
          slotDatetime,
          status: {
            notIn: [
              BookingStatus.CANCELLED_BY_PATIENT,
              BookingStatus.CANCELLED_BY_DOCTOR,
              BookingStatus.CANCELLED_BY_SYSTEM,
              BookingStatus.NO_SHOW,
            ],
          },
        },
      });
      if (conflict) {
        throw new ConflictException('This slot is no longer available');
      }

      // 8. Coupon validation + discount calculation
      let couponId: string | undefined;
      let discountAmount = 0;

      const feeBase =
        dto.consultType === 'IN_CLINIC'
          ? doctor.consultationFeeClinic
          : doctor.consultationFeeOnline;

      if (dto.couponCode) {
        const result = await this.applyCoupon(
          dto.couponCode,
          user.id,
          patient.id,
          feeBase,
        );
        couponId = result.couponId;
        discountAmount = result.discountAmount;
      }

      const feeCharged = Math.max(0, feeBase - discountAmount);

      // 9. Create Booking record
      const bookingRef = generateBookingRef();
      const booking = await this.prisma.booking.create({
        data: {
          id: bookingId,
          bookingRef,
          doctorId: doctor.id,
          patientId: patient.id,
          familyMemberId: dto.familyMemberId ?? null,
          clinicId: dto.clinicId ?? null,
          slotDatetime,
          consultType: dto.consultType,
          status: BookingStatus.PENDING_PAYMENT,
          feeCharged,
          discountAmount,
          couponId: couponId ?? null,
          patientNotes: dto.patientNotes ?? null,
        },
        include: {
          doctor: { include: { user: true } },
          clinic: { include: { city: true } },
        },
      });

      // 10. Schedule expiry job
      await this.expiryQueue.add(
        'expire',
        {
          bookingId,
          doctorId: doctor.id,
          slotDatetime: slotDatetime.toISOString(),
        } satisfies BookingExpiryJobData,
        { delay: BOOKING_PAYMENT_TIMEOUT_MS, jobId: `expire:${bookingId}` },
      );

      this.logger.log(`Booking ${bookingRef} created (PENDING_PAYMENT)`);

      return {
        booking: this.formatBooking(booking),
        paymentInfo: {
          amountPaise: feeCharged,
          currency: 'INR',
          description: `DocNear consultation — Dr. ${booking.doctor.user.firstName} ${booking.doctor.user.lastName}`,
        },
      };
    } catch (err) {
      // Release lock on any error after lock acquisition
      await this.redis.del(slotKey);
      throw err;
    }
  }

  // ── List ──────────────────────────────────────────────────────────────────

  async listBookings(userId: string, role: string, dto: ListBookingsDto) {
    const { page, limit, status, fromDate, toDate } = dto;
    const skip = (page - 1) * limit;

    let where: Prisma.BookingWhereInput = {};

    if (role === Role.PATIENT) {
      const patient = await this.prisma.patientProfile.findUnique({ where: { userId } });
      if (!patient) return { data: [], meta: { page, limit, total: 0, totalPages: 0 } };
      where = { patientId: patient.id };
    } else if (role === Role.DOCTOR) {
      const doctor = await this.prisma.doctorProfile.findUnique({ where: { userId } });
      if (!doctor) return { data: [], meta: { page, limit, total: 0, totalPages: 0 } };
      where = { doctorId: doctor.id };
    }

    if (status) where = { ...where, status };

    if (fromDate || toDate) {
      where = {
        ...where,
        slotDatetime: {
          ...(fromDate && { gte: new Date(`${fromDate}T00:00:00.000Z`) }),
          ...(toDate && { lte: new Date(`${toDate}T23:59:59.999Z`) }),
        },
      };
    }

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: {
          doctor: { include: { user: true } },
          clinic: { include: { city: true } },
          payment: { select: { status: true, razorpayOrderId: true, amountPaise: true } },
        },
        orderBy: { slotDatetime: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      data: bookings.map(b => this.formatBooking(b)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── Get one ───────────────────────────────────────────────────────────────

  async getBooking(userId: string, role: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        doctor: { include: { user: true } },
        clinic: { include: { city: true } },
        payment: true,
        consultation: true,
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    // Access control: patient owns booking or doctor owns slot
    await this.assertCanAccess(userId, role, booking);
    return this.formatBooking(booking);
  }

  // ── Cancel ────────────────────────────────────────────────────────────────

  async cancelBooking(
    userId: string,
    role: string,
    bookingId: string,
    dto: CancelBookingDto,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { doctor: true, patient: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    await this.assertCanAccess(userId, role, booking);

    let cancelledBy: CancelledBy;
    let allowedStatuses: BookingStatus[];

    if (role === Role.PATIENT) {
      cancelledBy = CancelledBy.PATIENT;
      allowedStatuses = CANCELLABLE_BY_PATIENT;
    } else if (role === Role.DOCTOR) {
      cancelledBy = CancelledBy.DOCTOR;
      allowedStatuses = CANCELLABLE_BY_DOCTOR;
    } else {
      cancelledBy = CancelledBy.ADMIN;
      allowedStatuses = Object.values(BookingStatus);
    }

    if (!allowedStatuses.includes(booking.status)) {
      throw new BadRequestException(
        `Cannot cancel a booking with status "${booking.status}"`,
      );
    }

    await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status:
          cancelledBy === CancelledBy.PATIENT
            ? BookingStatus.CANCELLED_BY_PATIENT
            : cancelledBy === CancelledBy.DOCTOR
            ? BookingStatus.CANCELLED_BY_DOCTOR
            : BookingStatus.CANCELLED_BY_SYSTEM,
        cancelledBy,
        cancelledAt: new Date(),
        cancellationReason: dto.reason,
      },
    });

    // Release Redis slot lock + bust cache
    const lockKey = REDIS_KEYS.slotLock(
      booking.doctorId,
      booking.slotDatetime.toISOString(),
    );
    await this.redis.del(lockKey);
    await this.redis.del(
      REDIS_KEYS.availableSlots(booking.doctorId, booking.slotDatetime.toISOString().slice(0, 10)),
    );

    // Remove pending expiry job (best-effort)
    const job = await this.expiryQueue.getJob(`expire:${bookingId}`);
    if (job) await job.remove();

    this.logger.log(`Booking ${booking.bookingRef} cancelled by ${cancelledBy}`);
    return { message: 'Booking cancelled successfully' };
  }

  // ── Internal (used by PaymentsService) ────────────────────────────────────

  /** Called by PaymentsService after payment.captured webhook */
  async confirmBooking(bookingId: string, razorpayPaymentId: string): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { doctorId: true, slotDatetime: true, feeCharged: true, status: true },
    });
    if (!booking || booking.status !== BookingStatus.PENDING_PAYMENT) return;

    const commission = Math.floor(
      (booking.feeCharged * 15) / 100, // PLATFORM_COMMISSION_PERCENT
    );

    await this.prisma.$transaction([
      // Confirm booking
      this.prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.CONFIRMED,
          confirmedAt: new Date(),
        },
      }),
      // Record doctor earning
      this.prisma.doctorEarning.create({
        data: {
          id: randomUUID(),
          doctorId: booking.doctorId,
          bookingId,
          grossAmountPaise: booking.feeCharged,
          platformCommissionPaise: commission,
          netAmountPaise: booking.feeCharged - commission,
        },
      }),
    ]);

    // Release slot lock — slot is now confirmed/taken
    const lockKey = REDIS_KEYS.slotLock(
      booking.doctorId,
      booking.slotDatetime.toISOString(),
    );
    await this.redis.del(lockKey);

    // Bust slot cache
    await this.redis.del(
      REDIS_KEYS.availableSlots(
        booking.doctorId,
        booking.slotDatetime.toISOString().slice(0, 10),
      ),
    );

    this.logger.log(`Booking ${bookingId} CONFIRMED — payment ${razorpayPaymentId}`);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async applyCoupon(
    code: string,
    userId: string,
    patientId: string,
    orderAmount: number,
  ) {
    const coupon = await this.prisma.coupon.findUnique({ where: { code } });

    if (
      !coupon ||
      !coupon.isActive ||
      coupon.validFrom > new Date() ||
      coupon.validUntil < new Date()
    ) {
      throw new BadRequestException('Coupon code is invalid or has expired');
    }

    if (coupon.applicableTo === 'PHARMACY') {
      throw new BadRequestException('This coupon is not applicable to consultations');
    }

    if (orderAmount < coupon.minOrderAmount) {
      throw new BadRequestException(
        `Minimum order amount for this coupon is ₹${coupon.minOrderAmount / 100}`,
      );
    }

    if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
      throw new BadRequestException('Coupon usage limit has been reached');
    }

    // Per-user limit check
    const userRedemptions = await this.prisma.couponRedemption.count({
      where: { couponId: coupon.id, userId },
    });
    if (userRedemptions >= coupon.perUserLimit) {
      throw new BadRequestException('You have reached the usage limit for this coupon');
    }

    // Calculate discount
    let discountAmount: number;
    if (coupon.type === CouponType.FLAT) {
      discountAmount = Math.min(coupon.value, orderAmount);
    } else {
      const raw = Math.floor((orderAmount * coupon.value) / 100);
      discountAmount = coupon.maxDiscount !== null ? Math.min(raw, coupon.maxDiscount) : raw;
    }

    return { couponId: coupon.id, discountAmount };
  }

  private async assertCanAccess(
    userId: string,
    role: string,
    booking: { doctorId: string; patientId: string; doctor?: { userId: string } | null; patient?: { userId: string } | null },
  ) {
    if (role === Role.SUPER_ADMIN) return; // admins can see all

    if (role === Role.PATIENT) {
      const patient = await this.prisma.patientProfile.findUnique({ where: { userId } });
      if (!patient || booking.patientId !== patient.id) {
        throw new ForbiddenException('Access denied');
      }
    } else if (role === Role.DOCTOR) {
      const doctor = await this.prisma.doctorProfile.findUnique({ where: { userId } });
      if (!doctor || booking.doctorId !== doctor.id) {
        throw new ForbiddenException('Access denied');
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private formatBooking(booking: any) {
    return {
      id: booking.id,
      bookingRef: booking.bookingRef,
      status: booking.status,
      slotDatetime: booking.slotDatetime,
      consultType: booking.consultType,
      feeCharged: booking.feeCharged,
      discountAmount: booking.discountAmount,
      patientNotes: booking.patientNotes,
      doctorNotes: booking.doctorNotes,
      cancellationReason: booking.cancellationReason,
      cancelledAt: booking.cancelledAt,
      confirmedAt: booking.confirmedAt,
      completedAt: booking.completedAt,
      createdAt: booking.createdAt,
      doctor: booking.doctor
        ? {
            id: booking.doctor.id,
            slug: booking.doctor.slug,
            firstName: booking.doctor.user?.firstName,
            lastName: booking.doctor.user?.lastName,
            avatarUrl: booking.doctor.user?.avatarUrl,
          }
        : null,
      clinic: booking.clinic
        ? {
            id: booking.clinic.id,
            name: booking.clinic.name,
            cityName: booking.clinic.city?.name,
          }
        : null,
      payment: booking.payment
        ? {
            status: booking.payment.status,
            amountPaise: booking.payment.amountPaise,
            razorpayOrderId: booking.payment.razorpayOrderId,
          }
        : null,
    };
  }
}

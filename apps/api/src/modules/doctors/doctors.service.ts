import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Inject,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';

// ─── Prisma payload types (derived from generated client) ────────────────────

type DoctorProfileFull = Prisma.DoctorProfileGetPayload<{
  include: {
    user: true;
    specialities: { include: { speciality: true } };
    clinics: { include: { city: true } };
    bankAccount: true;
  };
}>;

type DoctorProfileCard = Prisma.DoctorProfileGetPayload<{
  include: {
    user: true;
    specialities: { include: { speciality: true } };
    clinics: { include: { city: true } };
  };
}>;

import { randomUUID } from 'crypto';
import { Redis } from 'ioredis';
import { CryptoService } from '../../core/crypto/crypto.service';
import { PrismaService } from '../../core/database/prisma.service';
import { REDIS_CLIENT } from '../../core/redis/redis.constants';
import { AddBankAccountDto } from './dto/add-bank-account.dto';
import { AddClinicDto } from './dto/add-clinic.dto';
import {
  AddAvailabilityOverrideDto,
  SetAvailabilityDto,
} from './dto/set-availability.dto';
import { CreateDoctorProfileDto } from './dto/create-profile.dto';
import { UpdateDoctorProfileDto } from './dto/update-profile.dto';
import { ListDoctorsDto } from './dto/list-doctors.dto';

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Convert "HH:MM" string to a Date with that UTC time on 1970-01-01 */
function timeToDate(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(0); // 1970-01-01T00:00:00.000Z
  d.setUTCHours(h!, m!, 0, 0);
  return d;
}

/** Generate a URL-safe slug from a name */
function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class DoctorsService {
  private readonly logger = new Logger(DoctorsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  // ── Onboarding ────────────────────────────────────────────────────────────

  async onboard(userId: string, dto: CreateDoctorProfileDto) {
    // Verify the user is a DOCTOR
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.role !== Role.DOCTOR) {
      throw new ForbiddenException('Only doctors can create a doctor profile');
    }

    // One profile per doctor
    const exists = await this.prisma.doctorProfile.findUnique({ where: { userId } });
    if (exists) throw new ConflictException('Doctor profile already exists');

    // MCI reg number must be unique
    const regExists = await this.prisma.doctorProfile.findUnique({
      where: { mciRegNo: dto.mciRegNo },
    });
    if (regExists) throw new ConflictException('MCI registration number already registered');

    const slug = await this.uniqueSlug(
      `dr-${user.firstName}-${user.lastName}`,
    );

    const profile = await this.prisma.doctorProfile.create({
      data: {
        id: randomUUID(),
        userId,
        mciRegNo: dto.mciRegNo,
        qualifications: dto.qualifications,
        bio: dto.bio,
        experienceYears: dto.experienceYears,
        gender: dto.gender,
        languages: dto.languages ?? ['English'],
        consultationFeeClinic: dto.consultationFeeClinic,
        consultationFeeOnline: dto.consultationFeeOnline,
        slotDurationMinutes: dto.slotDurationMinutes ?? 15,
        slug,
      },
    });

    this.logger.log(`Doctor profile created: ${profile.id} for user ${userId}`);
    return this.formatProfile(profile, user);
  }

  // ── Own profile ───────────────────────────────────────────────────────────

  async getMyProfile(userId: string) {
    const profile = await this.prisma.doctorProfile.findUnique({
      where: { userId },
      include: {
        user: true,
        specialities: { include: { speciality: true } },
        clinics: { where: { isActive: true }, include: { city: true } },
        bankAccount: true,
      },
    });
    if (!profile) throw new NotFoundException('Doctor profile not found');

    return this.formatFullProfile(profile);
  }

  async updateMyProfile(userId: string, dto: UpdateDoctorProfileDto) {
    const profile = await this.requireProfile(userId);

    const updated = await this.prisma.doctorProfile.update({
      where: { id: profile.id },
      data: {
        ...(dto.qualifications !== undefined && { qualifications: dto.qualifications }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
        ...(dto.experienceYears !== undefined && { experienceYears: dto.experienceYears }),
        ...(dto.gender !== undefined && { gender: dto.gender }),
        ...(dto.languages !== undefined && { languages: dto.languages }),
        ...(dto.consultationFeeClinic !== undefined && {
          consultationFeeClinic: dto.consultationFeeClinic,
        }),
        ...(dto.consultationFeeOnline !== undefined && {
          consultationFeeOnline: dto.consultationFeeOnline,
        }),
        ...(dto.slotDurationMinutes !== undefined && {
          slotDurationMinutes: dto.slotDurationMinutes,
        }),
      },
      include: {
        user: true,
        specialities: { include: { speciality: true } },
        clinics: { include: { city: true } },
        bankAccount: true,
      },
    });

    // Bust the Redis cache for this doctor
    await this.redis.del(`doctor:profile:${profile.id}`);

    return this.formatFullProfile(updated);
  }

  // ── Bank account ──────────────────────────────────────────────────────────

  async addBankAccount(userId: string, dto: AddBankAccountDto) {
    const profile = await this.requireProfile(userId);

    const accountNumberEnc = this.crypto.encrypt(dto.accountNumber);
    const last4 = dto.accountNumber.slice(-4);

    await this.prisma.doctorBankAccount.upsert({
      where: { doctorId: profile.id },
      update: {
        accountNumberEnc,
        last4,
        ifscCode: dto.ifscCode.toUpperCase(),
        holderName: dto.holderName,
        bankName: dto.bankName,
        isVerified: false, // resets verification on change
      },
      create: {
        id: randomUUID(),
        doctorId: profile.id,
        accountNumberEnc,
        last4,
        ifscCode: dto.ifscCode.toUpperCase(),
        holderName: dto.holderName,
        bankName: dto.bankName,
        isVerified: false,
      },
    });

    return { message: 'Bank account saved. Verification pending.' };
  }

  // ── Clinics ───────────────────────────────────────────────────────────────

  async addClinic(userId: string, dto: AddClinicDto) {
    const profile = await this.requireProfile(userId);

    // Verify city exists
    await this.prisma.city.findUniqueOrThrow({ where: { id: dto.cityId } });

    const clinic = await this.prisma.clinic.create({
      data: {
        id: randomUUID(),
        doctorId: profile.id,
        name: dto.name,
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        cityId: dto.cityId,
        pincode: dto.pincode,
        lat: dto.lat,
        lng: dto.lng,
        phone: dto.phone,
        workingHours: dto.workingHours ?? {},
      },
      include: { city: true },
    });

    this.logger.log(`Clinic added: ${clinic.id} for doctor ${profile.id}`);
    return clinic;
  }

  async updateClinic(userId: string, clinicId: string, dto: Partial<AddClinicDto>) {
    const profile = await this.requireProfile(userId);
    await this.requireClinic(profile.id, clinicId);

    return this.prisma.clinic.update({
      where: { id: clinicId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.addressLine1 && { addressLine1: dto.addressLine1 }),
        ...(dto.addressLine2 !== undefined && { addressLine2: dto.addressLine2 }),
        ...(dto.pincode && { pincode: dto.pincode }),
        ...(dto.lat !== undefined && { lat: dto.lat }),
        ...(dto.lng !== undefined && { lng: dto.lng }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.workingHours !== undefined && { workingHours: dto.workingHours }),
      },
      include: { city: true },
    });
  }

  async deleteClinic(userId: string, clinicId: string) {
    const profile = await this.requireProfile(userId);
    await this.requireClinic(profile.id, clinicId);

    await this.prisma.clinic.update({
      where: { id: clinicId },
      data: { isActive: false },
    });
    return { message: 'Clinic deactivated' };
  }

  // ── Availability ──────────────────────────────────────────────────────────

  async getAvailability(userId: string) {
    const profile = await this.requireProfile(userId);
    const [availability, overrides] = await Promise.all([
      this.prisma.doctorAvailability.findMany({
        where: { doctorId: profile.id, isActive: true },
        include: { clinic: { include: { city: true } } },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      }),
      this.prisma.availabilityOverride.findMany({
        where: { doctorId: profile.id, overrideDate: { gte: new Date() } },
        orderBy: { overrideDate: 'asc' },
      }),
    ]);

    return {
      schedule: availability.map(a => ({
        id: a.id,
        dayOfWeek: a.dayOfWeek,
        startTime: this.formatTime(a.startTime),
        endTime: this.formatTime(a.endTime),
        consultType: a.consultType,
        clinicId: a.clinicId,
        clinicName: a.clinic?.name ?? null,
      })),
      overrides: overrides.map(o => ({
        id: o.id,
        overrideDate: o.overrideDate.toISOString().split('T')[0],
        isDayOff: o.isDayOff,
        startTime: o.startTime ? this.formatTime(o.startTime) : null,
        endTime: o.endTime ? this.formatTime(o.endTime) : null,
        clinicId: o.clinicId,
        reason: o.reason,
      })),
    };
  }

  async setAvailability(userId: string, dto: SetAvailabilityDto) {
    const profile = await this.requireProfile(userId);

    // Validate all clinic IDs belong to this doctor
    const clinicIds = dto.slots
      .filter(s => s.clinicId)
      .map(s => s.clinicId!);

    if (clinicIds.length > 0) {
      const count = await this.prisma.clinic.count({
        where: { id: { in: clinicIds }, doctorId: profile.id, isActive: true },
      });
      if (count !== new Set(clinicIds).size) {
        throw new BadRequestException('One or more clinic IDs are invalid or not yours');
      }
    }

    // Validate time ranges
    for (const slot of dto.slots) {
      const start = timeToDate(slot.startTime);
      const end = timeToDate(slot.endTime);
      if (start >= end) {
        throw new BadRequestException(
          `Day ${slot.dayOfWeek}: endTime must be after startTime`,
        );
      }
    }

    // Replace all existing availability in a transaction
    await this.prisma.$transaction([
      this.prisma.doctorAvailability.updateMany({
        where: { doctorId: profile.id },
        data: { isActive: false },
      }),
      ...dto.slots.map(slot =>
        this.prisma.doctorAvailability.create({
          data: {
            id: randomUUID(),
            doctorId: profile.id,
            dayOfWeek: slot.dayOfWeek,
            startTime: timeToDate(slot.startTime),
            endTime: timeToDate(slot.endTime),
            consultType: slot.consultType,
            clinicId: slot.clinicId ?? null,
          },
        }),
      ),
    ]);

    return { message: `Availability updated (${dto.slots.length} windows)` };
  }

  async addOverride(userId: string, dto: AddAvailabilityOverrideDto) {
    const profile = await this.requireProfile(userId);

    const overrideDate = new Date(dto.overrideDate);
    if (isNaN(overrideDate.getTime())) {
      throw new BadRequestException('Invalid overrideDate');
    }

    await this.prisma.availabilityOverride.upsert({
      where: { doctorId_overrideDate: { doctorId: profile.id, overrideDate } },
      update: {
        isDayOff: dto.isDayOff ?? false,
        startTime: dto.startTime ? timeToDate(dto.startTime) : null,
        endTime: dto.endTime ? timeToDate(dto.endTime) : null,
        clinicId: dto.clinicId ?? null,
        reason: dto.reason,
      },
      create: {
        id: randomUUID(),
        doctorId: profile.id,
        overrideDate,
        isDayOff: dto.isDayOff ?? false,
        startTime: dto.startTime ? timeToDate(dto.startTime) : null,
        endTime: dto.endTime ? timeToDate(dto.endTime) : null,
        clinicId: dto.clinicId ?? null,
        reason: dto.reason,
      },
    });

    return { message: 'Availability override saved' };
  }

  async deleteOverride(userId: string, overrideId: string) {
    const profile = await this.requireProfile(userId);
    const override = await this.prisma.availabilityOverride.findFirst({
      where: { id: overrideId, doctorId: profile.id },
    });
    if (!override) throw new NotFoundException('Override not found');

    await this.prisma.availabilityOverride.delete({ where: { id: overrideId } });
    return { message: 'Override deleted' };
  }

  // ── Public listing ────────────────────────────────────────────────────────

  async listDoctors(dto: ListDoctorsDto) {
    const { page, limit, cityId, specialityId, q, consultType, sortBy, sortOrder } = dto;
    const skip = (page - 1) * limit;

    const where: Prisma.DoctorProfileWhereInput = {
      verificationStatus: 'APPROVED',
      user: { status: 'APPROVED' },
      ...(specialityId && {
        specialities: { some: { specialityId } },
      }),
      ...(cityId && {
        clinics: { some: { cityId, isActive: true } },
      }),
      ...(consultType && {
        // If IN_CLINIC — must have active clinics; VIDEO — always available
        ...(consultType === 'IN_CLINIC'
          ? { clinics: { some: { isActive: true } } }
          : {}),
      }),
      ...(q && {
        OR: [
          { user: { firstName: { contains: q, mode: 'insensitive' } } },
          { user: { lastName: { contains: q, mode: 'insensitive' } } },
          { bio: { contains: q, mode: 'insensitive' } },
        ],
      }),
    };

    const orderBy: Prisma.DoctorProfileOrderByWithRelationInput =
      sortBy === 'rating'
        ? { avgRating: sortOrder ?? 'desc' }
        : sortBy === 'experience'
        ? { experienceYears: sortOrder ?? 'desc' }
        : sortBy === 'fee'
        ? { consultationFeeOnline: sortOrder ?? 'asc' }
        : { avgRating: 'desc' };

    const [profiles, total] = await Promise.all([
      this.prisma.doctorProfile.findMany({
        where,
        include: {
          user: true,
          specialities: {
            where: { isPrimary: true },
            include: { speciality: true },
          },
          clinics: {
            where: { isActive: true },
            include: { city: true },
            take: 1,
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.doctorProfile.count({ where }),
    ]);

    return {
      data: profiles.map(p => this.formatDoctorCard(p)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── Public — single doctor ─────────────────────────────────────────────────

  async getDoctorBySlug(slug: string) {
    const profile = await this.prisma.doctorProfile.findUnique({
      where: { slug },
      include: {
        user: true,
        specialities: { include: { speciality: true } },
        clinics: { where: { isActive: true }, include: { city: true } },
      },
    });
    if (!profile || profile.verificationStatus !== 'APPROVED') {
      throw new NotFoundException(`Doctor "${slug}" not found`);
    }
    return this.formatPublicProfile(profile);
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  /** Resolve doctor profile from userId; throw 404 if not found */
  async getProfileByUserId(userId: string) {
    const profile = await this.prisma.doctorProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Doctor profile not found');
    return profile;
  }

  private async requireProfile(userId: string) {
    const profile = await this.prisma.doctorProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Doctor profile not found. Complete onboarding first.');
    return profile;
  }

  private async requireClinic(doctorId: string, clinicId: string) {
    const clinic = await this.prisma.clinic.findFirst({
      where: { id: clinicId, doctorId, isActive: true },
    });
    if (!clinic) throw new NotFoundException('Clinic not found');
    return clinic;
  }

  private async uniqueSlug(base: string): Promise<string> {
    const slug = toSlug(base);
    for (let attempt = 0; attempt < 1000; attempt++) {
      const candidate = attempt === 0 ? slug : `${slug}-${attempt}`;
      const exists = await this.prisma.doctorProfile.findUnique({
        where: { slug: candidate },
      });
      if (!exists) return candidate;
    }
    // Extremely unlikely — fallback with timestamp
    return `${slug}-${Date.now()}`;
  }

  private formatTime(date: Date): string {
    return `${date.getUTCHours().toString().padStart(2, '0')}:${date.getUTCMinutes().toString().padStart(2, '0')}`;
  }

  private formatProfile(
    profile: { id: string; slug: string; mciRegNo: string },
    user: { firstName: string; lastName: string },
  ) {
    return { ...profile, firstName: user.firstName, lastName: user.lastName };
  }

  private formatFullProfile(profile: DoctorProfileFull) {
    const { user, bankAccount, specialities, clinics, ...rest } = profile;
    return {
      ...rest,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerified,
      status: user.status,
      specialities: specialities.map(ds => ({
        id: ds.speciality.id,
        name: ds.speciality.name,
        slug: ds.speciality.slug,
        isPrimary: ds.isPrimary,
      })),
      clinics: clinics.map(c => ({
        id: c.id,
        name: c.name,
        addressLine1: c.addressLine1,
        cityName: c.city?.name ?? null,
        cityId: c.cityId,
        lat: c.lat,
        lng: c.lng,
        pincode: c.pincode,
        phone: c.phone,
      })),
      bankAccount: bankAccount
        ? {
            last4: bankAccount.last4,
            holderName: bankAccount.holderName,
            bankName: bankAccount.bankName,
            ifscCode: bankAccount.ifscCode,
            isVerified: bankAccount.isVerified,
          }
        : null,
    };
  }

  private formatDoctorCard(profile: DoctorProfileCard) {
    const primarySpec = profile.specialities.find(s => s.isPrimary) ?? profile.specialities[0];
    const clinic = profile.clinics[0];
    return {
      id: profile.id,
      slug: profile.slug,
      firstName: profile.user.firstName,
      lastName: profile.user.lastName,
      avatarUrl: profile.user.avatarUrl,
      primarySpeciality: primarySpec
        ? {
            id: primarySpec.speciality.id,
            name: primarySpec.speciality.name,
            slug: primarySpec.speciality.slug,
          }
        : null,
      consultationFeeClinic: profile.consultationFeeClinic,
      consultationFeeOnline: profile.consultationFeeOnline,
      avgRating: profile.avgRating,
      totalReviews: profile.totalReviews,
      experienceYears: profile.experienceYears,
      languages: profile.languages,
      city: clinic ? { id: clinic.city?.id ?? null, name: clinic.city?.name ?? null } : null,
    };
  }

  private formatPublicProfile(profile: DoctorProfileCard) {
    return {
      id: profile.id,
      slug: profile.slug,
      firstName: profile.user.firstName,
      lastName: profile.user.lastName,
      avatarUrl: profile.user.avatarUrl,
      bio: profile.bio,
      experienceYears: profile.experienceYears,
      gender: profile.gender,
      languages: profile.languages,
      consultationFeeClinic: profile.consultationFeeClinic,
      consultationFeeOnline: profile.consultationFeeOnline,
      slotDurationMinutes: profile.slotDurationMinutes,
      avgRating: profile.avgRating,
      totalReviews: profile.totalReviews,
      totalConsultations: profile.totalConsultations,
      qualifications: profile.qualifications,
      specialities: profile.specialities.map(ds => ({
        id: ds.speciality.id,
        name: ds.speciality.name,
        slug: ds.speciality.slug,
        iconUrl: ds.speciality.iconUrl,
        isPrimary: ds.isPrimary,
      })),
      clinics: profile.clinics.map(c => ({
        id: c.id,
        name: c.name,
        addressLine1: c.addressLine1,
        cityName: c.city?.name ?? null,
        cityId: c.cityId,
        lat: c.lat,
        lng: c.lng,
        pincode: c.pincode,
        phone: c.phone,
        workingHours: c.workingHours,
      })),
    };
  }
}

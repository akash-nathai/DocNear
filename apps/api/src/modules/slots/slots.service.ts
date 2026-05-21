import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConsultationType } from '@prisma/client';
import { Redis } from 'ioredis';
import { REDIS_KEYS } from '../../common/constants';
import { PrismaService } from '../../core/database/prisma.service';
import { REDIS_CLIENT } from '../../core/redis/redis.constants';
import { GetSlotsDto } from './dto/get-slots.dto';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SlotResult {
  datetime: string;             // ISO 8601 UTC e.g. "2026-05-21T09:00:00.000Z"
  consultType: ConsultationType;
  clinicId: string | null;
  clinicName: string | null;
  available: boolean;
}

// ─── Slot generation helpers ──────────────────────────────────────────────────

/**
 * Generate a slot list for a single availability window.
 *
 * NOTE: Times are stored as UTC in the database (Prisma @db.Time / @db.Date).
 *       Production apps should resolve timezone from the doctor's clinic location.
 *       For now we work entirely in UTC — the frontend handles display conversion.
 */
function generateWindowSlots(
  date: Date,             // calendar date (hours set to 00:00 UTC)
  startTime: Date,        // Prisma Time field — UTC hours/minutes only
  endTime: Date,          // same
  slotMinutes: number,
): Date[] {
  const slots: Date[] = [];

  const start = new Date(date);
  start.setUTCHours(startTime.getUTCHours(), startTime.getUTCMinutes(), 0, 0);

  const end = new Date(date);
  end.setUTCHours(endTime.getUTCHours(), endTime.getUTCMinutes(), 0, 0);

  const slotMs = slotMinutes * 60 * 1000;
  let cur = new Date(start);

  while (cur.getTime() + slotMs <= end.getTime()) {
    slots.push(new Date(cur));
    cur = new Date(cur.getTime() + slotMs);
  }

  return slots;
}

/** Parse YYYY-MM-DD into a UTC midnight Date */
function parseDateParam(dateStr: string): Date {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  if (isNaN(d.getTime())) throw new Error(`Invalid date: ${dateStr}`);
  return d;
}

/** Cache TTL for generated slot lists: 5 minutes */
const SLOT_CACHE_TTL = 300;

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class SlotsService {
  private readonly logger = new Logger(SlotsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * GET /v1/slots/:doctorSlug?date=YYYY-MM-DD&consultType=...
   *
   * Algorithm:
   *  1. Resolve doctor by slug → get doctorId + slotDurationMinutes
   *  2. Check for AvailabilityOverride on the given date
   *     - isDayOff → return empty list immediately
   *     - has custom hours → use those windows instead of regular schedule
   *  3. Find DoctorAvailability records matching dayOfWeek
   *  4. Generate all candidate slots within availability windows
   *  5. Mark slots booked if there's a non-cancelled Booking for that datetime
   *  6. Mark slots locked if a Redis key exists (PENDING_PAYMENT in-flight)
   *  7. Cache result in Redis for SLOT_CACHE_TTL seconds
   */
  async getSlots(doctorSlug: string, dto: GetSlotsDto): Promise<SlotResult[]> {
    const date = parseDateParam(dto.date);
    const dayOfWeek = date.getUTCDay(); // 0=Sunday

    // ── 1. Resolve doctor ───────────────────────────────────────────────────
    const profile = await this.prisma.doctorProfile.findUnique({
      where: { slug: doctorSlug },
      include: { clinics: { where: { isActive: true }, include: { city: true } } },
    });
    if (!profile || profile.verificationStatus !== 'APPROVED') {
      throw new NotFoundException(`Doctor "${doctorSlug}" not found`);
    }

    const cacheKey = REDIS_KEYS.availableSlots(profile.id, dto.date);

    // ── 2. Check override ───────────────────────────────────────────────────
    const override = await this.prisma.availabilityOverride.findUnique({
      where: { doctorId_overrideDate: { doctorId: profile.id, overrideDate: date } },
    });

    if (override?.isDayOff) {
      return []; // doctor is off — no slots
    }

    // ── 3. Availability windows ─────────────────────────────────────────────
    let windows: Array<{
      startTime: Date;
      endTime: Date;
      consultType: ConsultationType;
      clinicId: string | null;
    }> = [];

    if (override && override.startTime && override.endTime) {
      // Override with custom hours — single window
      windows = [
        {
          startTime: override.startTime,
          endTime: override.endTime,
          consultType: ConsultationType.IN_CLINIC, // override can be either type
          clinicId: override.clinicId,
        },
      ];
    } else {
      // Regular weekly schedule
      const avail = await this.prisma.doctorAvailability.findMany({
        where: { doctorId: profile.id, dayOfWeek, isActive: true },
      });
      windows = avail.map(a => ({
        startTime: a.startTime,
        endTime: a.endTime,
        consultType: a.consultType,
        clinicId: a.clinicId,
      }));
    }

    // Apply consultType filter
    if (dto.consultType) {
      windows = windows.filter(w => w.consultType === dto.consultType);
    }

    if (windows.length === 0) return [];

    // ── 4. Generate candidate slots ─────────────────────────────────────────
    const clinicMap = new Map(profile.clinics.map(c => [c.id, c.name]));

    const allSlots: SlotResult[] = [];
    for (const w of windows) {
      const times = generateWindowSlots(date, w.startTime, w.endTime, profile.slotDurationMinutes);
      for (const t of times) {
        allSlots.push({
          datetime: t.toISOString(),
          consultType: w.consultType,
          clinicId: w.clinicId,
          clinicName: w.clinicId ? (clinicMap.get(w.clinicId) ?? null) : null,
          available: true,
        });
      }
    }

    if (allSlots.length === 0) return [];

    // ── 5. Mark booked slots ────────────────────────────────────────────────
    const dayStart = new Date(date);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setUTCHours(23, 59, 59, 999);

    const bookedSlots = await this.prisma.booking.findMany({
      where: {
        doctorId: profile.id,
        slotDatetime: { gte: dayStart, lte: dayEnd },
        status: {
          notIn: [
            'CANCELLED_BY_PATIENT',
            'CANCELLED_BY_DOCTOR',
            'CANCELLED_BY_SYSTEM',
            'NO_SHOW',
          ],
        },
      },
      select: { slotDatetime: true },
    });

    const bookedSet = new Set(bookedSlots.map(b => b.slotDatetime.toISOString()));

    // ── 6. Mark Redis-locked slots ──────────────────────────────────────────
    const lockKeys = allSlots.map(s =>
      REDIS_KEYS.slotLock(profile.id, s.datetime),
    );

    const lockValues = await Promise.all(lockKeys.map(k => this.redis.exists(k)));

    // ── 7. Combine results ──────────────────────────────────────────────────
    const results: SlotResult[] = allSlots.map((slot, i) => ({
      ...slot,
      available:
        !bookedSet.has(slot.datetime) &&   // not DB-booked
        lockValues[i] === 0,               // not Redis-locked
    }));

    // Cache for SLOT_CACHE_TTL (bust on new booking in BookingsService)
    await this.redis.set(cacheKey, JSON.stringify(results), 'EX', SLOT_CACHE_TTL);

    this.logger.debug(
      `Slots for ${doctorSlug}/${dto.date}: ${results.length} total, ${results.filter(s => s.available).length} available`,
    );

    return results;
  }
}

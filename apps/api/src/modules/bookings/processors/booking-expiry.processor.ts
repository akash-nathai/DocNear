import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_KEYS } from '../../../common/constants';
import { PrismaService } from '../../../core/database/prisma.service';
import { REDIS_CLIENT } from '../../../core/redis/redis.constants';
import { BOOKING_EXPIRY_QUEUE } from '../bookings.constants';

export interface BookingExpiryJobData {
  bookingId: string;
  doctorId: string;
  slotDatetime: string; // ISO string — for Redis key
}

/**
 * BookingExpiryProcessor — cancels bookings that remain PENDING_PAYMENT after
 * the payment timeout (default 15 minutes).
 *
 * The job is enqueued by BookingsService.createBooking with a delay equal to
 * BOOKING_PAYMENT_TIMEOUT_MIN * 60 * 1000 ms.
 */
@Injectable()
@Processor(BOOKING_EXPIRY_QUEUE)
export class BookingExpiryProcessor extends WorkerHost {
  private readonly logger = new Logger(BookingExpiryProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    super();
  }

  async process(job: Job<BookingExpiryJobData>): Promise<void> {
    const { bookingId, doctorId, slotDatetime } = job.data;
    this.logger.debug(`Processing expiry for booking ${bookingId}`);

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { status: true },
    });

    if (!booking) {
      this.logger.warn(`Booking ${bookingId} not found — skipping expiry`);
      return;
    }

    if (booking.status !== 'PENDING_PAYMENT') {
      // Already confirmed, cancelled, etc. — nothing to do
      this.logger.debug(`Booking ${bookingId} is ${booking.status} — skipping expiry`);
      return;
    }

    // Cancel the booking
    await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'CANCELLED_BY_SYSTEM',
        cancelledBy: 'SYSTEM',
        cancelledAt: new Date(),
        cancellationReason: 'Payment timeout — booking auto-cancelled after 15 minutes',
      },
    });

    // Release the Redis slot lock
    const lockKey = REDIS_KEYS.slotLock(doctorId, slotDatetime);
    await this.redis.del(lockKey);

    // Bust slot cache for that day
    const date = slotDatetime.slice(0, 10); // YYYY-MM-DD
    await this.redis.del(REDIS_KEYS.availableSlots(doctorId, date));

    this.logger.log(
      `Booking ${bookingId} auto-cancelled (PENDING_PAYMENT timeout)`,
    );
  }
}

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import Razorpay from 'razorpay';
import { randomUUID } from 'crypto';
import { BookingStatus, PaymentStatus, Role } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { BookingsService } from '../bookings/bookings.service';

// ─── Razorpay webhook event shape (minimal) ───────────────────────────────────

interface RazorpayWebhookPayload {
  entity: string;
  account_id: string;
  event: string;
  payload: {
    payment?: {
      entity: {
        id: string;
        order_id: string;
        status: string;
        amount: number;
        currency: string;
        method?: string;
        error_code?: string;
        error_description?: string;
      };
    };
  };
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly razorpay: Razorpay;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly bookingsService: BookingsService,
  ) {
    this.razorpay = new Razorpay({
      key_id: this.config.get<string>('razorpay.keyId')!,
      key_secret: this.config.get<string>('razorpay.keySecret')!,
    });
  }

  // ── Create Razorpay order ─────────────────────────────────────────────────

  /**
   * Creates a Razorpay order for a PENDING_PAYMENT booking.
   * Returns the order ID + key_id for the frontend checkout.
   *
   * Idempotent: if a Payment record already exists for this booking (order
   * created but page was refreshed) we return the existing order.
   */
  async createOrder(bookingId: string, userId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { patient: { include: { user: true } } },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    // Only the patient who owns the booking can pay
    if (booking.patient.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    if (booking.status !== BookingStatus.PENDING_PAYMENT) {
      throw new BadRequestException(
        `Cannot create a payment order for a booking with status "${booking.status}"`,
      );
    }

    // Idempotent: return existing pending order if present
    const existing = await this.prisma.payment.findUnique({
      where: { bookingId },
      select: { razorpayOrderId: true, amountPaise: true, status: true },
    });
    if (existing && existing.status === PaymentStatus.PENDING) {
      return {
        orderId: existing.razorpayOrderId,
        amountPaise: existing.amountPaise,
        currency: 'INR',
        keyId: this.config.get<string>('razorpay.keyId'),
      };
    }

    // Create Razorpay order
    const order = await this.razorpay.orders.create({
      amount: booking.feeCharged,
      currency: 'INR',
      receipt: booking.bookingRef,
    });

    // Persist Payment record (status PENDING)
    await this.prisma.payment.create({
      data: {
        id: randomUUID(),
        bookingId,
        razorpayOrderId: order.id,
        status: PaymentStatus.PENDING,
        amountPaise: booking.feeCharged,
        currency: 'INR',
      },
    });

    this.logger.log(`Razorpay order ${order.id} created for booking ${booking.bookingRef}`);

    return {
      orderId: order.id,
      amountPaise: booking.feeCharged,
      currency: 'INR',
      keyId: this.config.get<string>('razorpay.keyId'),
    };
  }

  // ── Handle Razorpay webhook ───────────────────────────────────────────────

  /**
   * Called by the webhook controller with the raw request body and the
   * X-Razorpay-Signature header value.
   *
   * 1. HMAC-SHA256 verification (timing-safe comparison)
   * 2. Idempotency via WebhookEvent INSERT … ON CONFLICT DO NOTHING
   * 3. Route to payment.captured / payment.failed handlers
   */
  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    // 1. Verify signature
    const webhookSecret = this.config.get<string>('razorpay.webhookSecret')!;
    const expectedSig = createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    const isValid = timingSafeEqual(
      Buffer.from(expectedSig, 'hex'),
      Buffer.from(signature, 'hex'),
    );

    if (!isValid) {
      this.logger.warn('Razorpay webhook HMAC verification failed');
      throw new BadRequestException('Invalid webhook signature');
    }

    // 2. Parse payload
    const event = JSON.parse(rawBody.toString('utf8')) as RazorpayWebhookPayload;
    const eventId = `${event.account_id}:${event.event}:${event.payload.payment?.entity.id ?? 'unknown'}`;

    // 3. Idempotency — INSERT with ON CONFLICT DO NOTHING via Prisma
    //    If count returned is 0, it was a duplicate — skip processing.
    try {
      await this.prisma.webhookEvent.create({
        data: {
          id: randomUUID(),
          provider: 'razorpay',
          eventId,
          eventType: event.event,
          payload: event as object,
        },
      });
    } catch {
      // Unique constraint violation → duplicate event, skip silently
      this.logger.debug(`Duplicate webhook event ${eventId} — skipping`);
      return;
    }

    // 4. Route
    switch (event.event) {
      case 'payment.captured':
        await this.onPaymentCaptured(event);
        break;
      case 'payment.failed':
        await this.onPaymentFailed(event);
        break;
      default:
        this.logger.debug(`Unhandled Razorpay event: ${event.event}`);
    }
  }

  // ── Get payment for a booking ─────────────────────────────────────────────

  async getPayment(bookingId: string, userId: string, role: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { bookingId },
      include: {
        booking: {
          include: { patient: { include: { user: true } } },
        },
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    // Access control
    if (role === Role.PATIENT && payment.booking.patient.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    if (role === Role.DOCTOR) {
      const doctor = await this.prisma.doctorProfile.findUnique({ where: { userId } });
      if (!doctor || payment.booking.doctorId !== doctor.id) {
        throw new ForbiddenException('Access denied');
      }
    }

    return {
      id: payment.id,
      bookingId: payment.bookingId,
      razorpayOrderId: payment.razorpayOrderId,
      razorpayPaymentId: payment.razorpayPaymentId,
      status: payment.status,
      amountPaise: payment.amountPaise,
      currency: payment.currency,
      method: payment.method,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
    };
  }

  // ── Private handlers ──────────────────────────────────────────────────────

  private async onPaymentCaptured(event: RazorpayWebhookPayload): Promise<void> {
    const paymentEntity = event.payload.payment?.entity;
    if (!paymentEntity) return;

    const { id: razorpayPaymentId, order_id: razorpayOrderId, method } = paymentEntity;

    const payment = await this.prisma.payment.findUnique({
      where: { razorpayOrderId },
      select: { bookingId: true, status: true },
    });

    if (!payment) {
      this.logger.warn(`payment.captured: no Payment row for order ${razorpayOrderId}`);
      return;
    }

    if (payment.status !== PaymentStatus.PENDING) {
      this.logger.debug(`payment.captured: already processed for order ${razorpayOrderId}`);
      return;
    }

    // Update Payment record to CAPTURED
    await this.prisma.payment.update({
      where: { razorpayOrderId },
      data: {
        razorpayPaymentId,
        razorpaySignature: razorpayPaymentId, // stored as-is from event
        status: PaymentStatus.CAPTURED,
        method: method ?? null,
        gatewayResponse: paymentEntity as object,
        paidAt: new Date(),
      },
    });

    // Confirm the booking + create DoctorEarning
    await this.bookingsService.confirmBooking(payment.bookingId, razorpayPaymentId);

    this.logger.log(
      `Payment captured — order ${razorpayOrderId}, booking ${payment.bookingId}`,
    );
  }

  private async onPaymentFailed(event: RazorpayWebhookPayload): Promise<void> {
    const paymentEntity = event.payload.payment?.entity;
    if (!paymentEntity) return;

    const { order_id: razorpayOrderId } = paymentEntity;

    const payment = await this.prisma.payment.findUnique({
      where: { razorpayOrderId },
      select: { bookingId: true, status: true },
    });

    if (!payment || payment.status !== PaymentStatus.PENDING) return;

    await this.prisma.payment.update({
      where: { razorpayOrderId },
      data: {
        status: PaymentStatus.FAILED,
        gatewayResponse: paymentEntity as object,
      },
    });

    this.logger.warn(
      `Payment failed — order ${razorpayOrderId}, booking ${payment.bookingId}. ` +
        `Error: ${paymentEntity.error_code} — ${paymentEntity.error_description}`,
    );
    // Note: the BullMQ expiry job will cancel the booking after the 15-min window.
    // No immediate action needed here; the patient may retry payment.
  }
}

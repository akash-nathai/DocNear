import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { BookingStatus, ConsultationStatus, NotifChannel, NotifType, Role } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UpdateConsultationStatusDto } from './dto/update-status.dto';

/** Window (ms) around the slot when joining is allowed */
const JOIN_WINDOW_MS = 15 * 60 * 1000; // ±15 minutes

@Injectable()
export class ConsultationsService {
  private readonly logger = new Logger(ConsultationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Create / get room ─────────────────────────────────────────────────────

  /**
   * Creates (or returns) the consultation room for a confirmed booking.
   * Enforces the ±15-minute joining window.
   * Returns stub room codes; swap `hmsRoomId` generation for the real 100ms SDK.
   */
  async joinRoom(bookingId: string, userId: string, role: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        doctor: { include: { user: true } },
        patient: { include: { user: true } },
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    // Access control
    this.assertCanAccessBooking(userId, role, booking);

    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException('Booking must be CONFIRMED to join the consultation');
    }

    // Enforce time window
    const now = Date.now();
    const slotMs = booking.slotDatetime.getTime();
    if (now < slotMs - JOIN_WINDOW_MS || now > slotMs + JOIN_WINDOW_MS) {
      throw new BadRequestException(
        'You can only join the consultation within 15 minutes of the scheduled time',
      );
    }

    // Upsert consultation record
    let consultation = await this.prisma.consultation.findUnique({ where: { bookingId } });

    if (!consultation) {
      // Generate stub room codes — replace with 100ms SDK call in production
      const hmsRoomId = `room_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
      consultation = await this.prisma.consultation.create({
        data: {
          id: randomUUID(),
          bookingId,
          hmsRoomId,
          hmsRoomCodeDoctor: `${hmsRoomId}_doc`,
          hmsRoomCodePatient: `${hmsRoomId}_pat`,
          status: ConsultationStatus.WAITING,
        },
      });

      // Notify both parties that the room is ready
      await this.notifications.dispatch({
        userId: booking.doctor.userId,
        type: NotifType.CONSULT_STARTED,
        title: 'Consultation room ready',
        body: `Your video consultation with ${booking.patient.user.firstName} is ready to join`,
        channels: [NotifChannel.IN_APP, NotifChannel.PUSH],
      });
    }

    // Return the appropriate room code based on caller role
    const roomCode =
      role === Role.DOCTOR
        ? consultation.hmsRoomCodeDoctor
        : consultation.hmsRoomCodePatient;

    return {
      consultationId: consultation.id,
      hmsRoomId: consultation.hmsRoomId,
      roomCode,
      status: consultation.status,
    };
  }

  // ── Status transitions ────────────────────────────────────────────────────

  /**
   * PATCH /v1/consultations/:bookingId/status
   * Doctor-only: WAITING → ACTIVE → COMPLETED (or ABANDONED)
   */
  async updateStatus(
    bookingId: string,
    userId: string,
    role: string,
    dto: UpdateConsultationStatusDto,
  ) {
    if (role !== Role.DOCTOR) {
      throw new ForbiddenException('Only the doctor can update consultation status');
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { doctor: true, patient: { include: { user: true } } },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    // Verify this doctor owns the booking
    const doctor = await this.prisma.doctorProfile.findUnique({ where: { userId } });
    if (!doctor || booking.doctorId !== doctor.id) {
      throw new ForbiddenException('Access denied');
    }

    const consultation = await this.prisma.consultation.findUnique({ where: { bookingId } });
    if (!consultation) throw new NotFoundException('Consultation not found — call joinRoom first');

    const now = new Date();
    const updateData: Record<string, unknown> = { status: dto.status };

    if (dto.status === ConsultationStatus.ACTIVE && !consultation.startedAt) {
      updateData['startedAt'] = now;
    }
    if (
      dto.status === ConsultationStatus.COMPLETED ||
      dto.status === ConsultationStatus.ABANDONED
    ) {
      updateData['endedAt'] = now;
      if (consultation.startedAt) {
        updateData['durationSeconds'] = Math.floor(
          (now.getTime() - consultation.startedAt.getTime()) / 1000,
        );
      }
    }

    await this.prisma.consultation.update({
      where: { bookingId },
      data: updateData,
    });

    // On completion, mark booking as COMPLETED
    if (dto.status === ConsultationStatus.COMPLETED) {
      await this.prisma.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.COMPLETED, completedAt: now },
      });

      // Notify patient to leave a review (best-effort)
      await this.notifications.dispatch({
        userId: booking.patient.userId,
        type: NotifType.CONSULT_ENDED,
        title: 'Consultation completed',
        body: 'Your consultation has ended. Please leave a review for your doctor.',
        channels: [NotifChannel.IN_APP, NotifChannel.PUSH],
      });
    }

    this.logger.log(`Consultation for booking ${bookingId} → ${dto.status}`);
    return { bookingId, status: dto.status };
  }

  // ── Get consultation detail ───────────────────────────────────────────────

  async getConsultation(bookingId: string, userId: string, role: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { doctor: true, patient: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    this.assertCanAccessBooking(userId, role, booking);

    const consultation = await this.prisma.consultation.findUnique({ where: { bookingId } });
    if (!consultation) throw new NotFoundException('Consultation not found');
    return consultation;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private assertCanAccessBooking(
    userId: string,
    role: string,
    booking: { doctor: { userId: string }; patient: { userId: string } },
  ) {
    if (role === Role.SUPER_ADMIN) return;
    if (role === Role.DOCTOR && booking.doctor.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    if (role === Role.PATIENT && booking.patient.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }
  }
}

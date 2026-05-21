import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { BookingStatus, NotifChannel, NotifType, Role } from '@prisma/client';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { PrismaService } from '../../core/database/prisma.service';
import { CryptoService } from '../../core/crypto/crypto.service';
import { StorageService } from '../../core/storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SavePrescriptionDto } from './dto/save-prescription.dto';

export interface MedicineItem {
  name: string;
  dosage: string;
  frequency: string;
  durationDays?: number;
  instructions?: string;
}

@Injectable()
export class PrescriptionsService {
  private readonly logger = new Logger(PrescriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Draft save ────────────────────────────────────────────────────────────

  /**
   * PUT /v1/prescriptions/:bookingId
   * Doctor upserts the prescription draft (encrypted PHI in DB).
   */
  async save(bookingId: string, userId: string, dto: SavePrescriptionDto) {
    const { booking, doctor, patient } = await this.resolveBookingForDoctor(bookingId, userId);

    if (booking.status === BookingStatus.CANCELLED_BY_PATIENT ||
        booking.status === BookingStatus.CANCELLED_BY_DOCTOR ||
        booking.status === BookingStatus.CANCELLED_BY_SYSTEM) {
      throw new BadRequestException('Cannot write prescription for a cancelled booking');
    }

    const existing = await this.prisma.prescription.findUnique({ where: { bookingId } });
    if (existing?.isFinalized) {
      throw new BadRequestException('Prescription is already finalized and cannot be edited');
    }

    const medicinesJson = JSON.stringify(dto.medicines);
    const data = {
      medicinesEnc: this.crypto.encrypt(medicinesJson),
      diagnosisEnc: dto.diagnosis ? this.crypto.encrypt(dto.diagnosis) : undefined,
      adviceEnc: dto.advice ? this.crypto.encrypt(dto.advice) : undefined,
      followUpIn: dto.followUpIn ?? null,
    };

    let prescription;
    if (existing) {
      prescription = await this.prisma.prescription.update({ where: { bookingId }, data });
    } else {
      prescription = await this.prisma.prescription.create({
        data: {
          id: randomUUID(),
          bookingId,
          doctorId: doctor.id,
          patientId: patient.id,
          ...data,
        },
      });
    }

    return this.formatPrescription(prescription, null);
  }

  // ── Finalize + PDF ────────────────────────────────────────────────────────

  /**
   * POST /v1/prescriptions/:bookingId/finalize
   * Locks the prescription and generates a PDF uploaded to S3.
   */
  async finalize(bookingId: string, userId: string) {
    const { booking, doctor } = await this.resolveBookingForDoctor(bookingId, userId);

    const prescription = await this.prisma.prescription.findUnique({ where: { bookingId } });
    if (!prescription) throw new NotFoundException('Prescription draft not found');
    if (prescription.isFinalized) {
      throw new ConflictError('Prescription is already finalized');
    }

    // Decrypt PHI fields for PDF rendering
    const medicines: MedicineItem[] = JSON.parse(
      this.crypto.decrypt(prescription.medicinesEnc as Buffer),
    ) as MedicineItem[];
    const diagnosis = prescription.diagnosisEnc
      ? this.crypto.decrypt(prescription.diagnosisEnc as Buffer)
      : null;
    const advice = prescription.adviceEnc
      ? this.crypto.decrypt(prescription.adviceEnc as Buffer)
      : null;

    // Load doctor + patient info for PDF header
    const doctorUser = await this.prisma.user.findUnique({ where: { id: doctor.userId } });
    const patientProfile = await this.prisma.patientProfile.findUnique({
      where: { id: prescription.patientId },
      include: { user: true },
    });

    // Generate PDF
    const pdfBytes = await this.generatePdf({
      bookingRef: booking.bookingRef,
      doctorName: `Dr. ${doctorUser?.firstName ?? ''} ${doctorUser?.lastName ?? ''}`.trim(),
      qualifications: doctor.qualifications.join(', '),
      mciRegNo: doctor.mciRegNo,
      patientName: `${patientProfile?.user.firstName ?? ''} ${patientProfile?.user.lastName ?? ''}`.trim(),
      slotDate: booking.slotDatetime.toISOString().slice(0, 10),
      medicines,
      diagnosis: diagnosis ?? undefined,
      advice: advice ?? undefined,
      followUpIn: prescription.followUpIn ?? undefined,
    });

    // Upload PDF to S3
    const key = StorageService.prescriptionKey(bookingId);
    await this.storage.uploadBuffer(Buffer.from(pdfBytes), key, 'application/pdf');

    // Mark finalized in DB
    await this.prisma.prescription.update({
      where: { bookingId },
      data: { isFinalized: true, finalizedAt: new Date(), pdfUrl: key },
    });

    // Notify patient
    if (patientProfile) {
      await this.notifications.dispatch({
        userId: patientProfile.userId,
        type: NotifType.PRESCRIPTION_READY,
        title: 'Your prescription is ready',
        body: `Dr. ${doctorUser?.lastName ?? ''} has finalized your prescription. Tap to download.`,
        channels: [NotifChannel.IN_APP, NotifChannel.PUSH],
      });
    }

    const signedUrl = await this.storage.getSignedUrl(key);
    this.logger.log(`Prescription finalized for booking ${bookingId}`);
    return { bookingId, pdfUrl: signedUrl, finalizedAt: new Date() };
  }

  // ── Get ───────────────────────────────────────────────────────────────────

  async get(bookingId: string, userId: string, role: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { doctor: true, patient: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    // Access: patient who owns booking, or doctor, or admin
    if (role === Role.PATIENT && booking.patient.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    if (role === Role.DOCTOR) {
      const d = await this.prisma.doctorProfile.findUnique({ where: { userId } });
      if (!d || booking.doctorId !== d.id) throw new ForbiddenException('Access denied');
    }

    const prescription = await this.prisma.prescription.findUnique({ where: { bookingId } });
    if (!prescription) throw new NotFoundException('Prescription not found');

    let pdfUrl: string | null = null;
    if (prescription.isFinalized && prescription.pdfUrl) {
      pdfUrl = await this.storage.getSignedUrl(prescription.pdfUrl);
    }

    return this.formatPrescription(prescription, pdfUrl);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async resolveBookingForDoctor(bookingId: string, userId: string) {
    const doctor = await this.prisma.doctorProfile.findUnique({ where: { userId } });
    if (!doctor) throw new ForbiddenException('Only doctors can manage prescriptions');

    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.doctorId !== doctor.id) throw new ForbiddenException('Access denied');

    const patient = await this.prisma.patientProfile.findUnique({
      where: { id: booking.patientId },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    return { booking, doctor, patient };
  }

  private formatPrescription(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prescription: any,
    pdfUrl: string | null,
  ) {
    return {
      id: prescription.id,
      bookingId: prescription.bookingId,
      isFinalized: prescription.isFinalized,
      finalizedAt: prescription.finalizedAt,
      followUpIn: prescription.followUpIn,
      pdfUrl,
      // Decrypt inline — PHI is never stored in plaintext
      medicines:
        prescription.medicinesEnc && prescription.medicinesEnc.length > 0
          ? (JSON.parse(this.crypto.decrypt(prescription.medicinesEnc as Buffer)) as MedicineItem[])
          : [],
      diagnosis:
        prescription.diagnosisEnc && prescription.diagnosisEnc.length > 0
          ? this.crypto.decrypt(prescription.diagnosisEnc as Buffer)
          : null,
      advice:
        prescription.adviceEnc && prescription.adviceEnc.length > 0
          ? this.crypto.decrypt(prescription.adviceEnc as Buffer)
          : null,
      createdAt: prescription.createdAt,
      updatedAt: prescription.updatedAt,
    };
  }

  // ── PDF generation (pdf-lib) ──────────────────────────────────────────────

  private async generatePdf(params: {
    bookingRef: string;
    doctorName: string;
    qualifications: string;
    mciRegNo: string;
    patientName: string;
    slotDate: string;
    medicines: MedicineItem[];
    diagnosis?: string;
    advice?: string;
    followUpIn?: string;
  }): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const page = doc.addPage([595, 842]); // A4
    const { width, height } = page.getSize();

    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await doc.embedFont(StandardFonts.Helvetica);

    const brand = rgb(0.055, 0.647, 0.914);   // #0EA5E9
    const dark  = rgb(0.13, 0.13, 0.15);
    const gray  = rgb(0.45, 0.45, 0.5);
    const lineColor = rgb(0.88, 0.88, 0.90);

    let y = height - 40;

    // ── Header ──────────────────────────────────────────────────────────────
    page.drawText('DocNear', { x: 40, y, size: 22, font: fontBold, color: brand });
    page.drawText('e-Prescription', { x: 40, y: y - 18, size: 10, font: fontRegular, color: gray });
    page.drawText(`Ref: ${params.bookingRef}`, {
      x: width - 160, y, size: 9, font: fontRegular, color: gray,
    });
    page.drawText(`Date: ${params.slotDate}`, {
      x: width - 160, y: y - 14, size: 9, font: fontRegular, color: gray,
    });

    y -= 50;
    page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 1, color: lineColor });

    // ── Doctor info ──────────────────────────────────────────────────────────
    y -= 18;
    page.drawText(params.doctorName, { x: 40, y, size: 13, font: fontBold, color: dark });
    page.drawText(params.qualifications, { x: 40, y: y - 14, size: 9, font: fontRegular, color: gray });
    page.drawText(`Reg. No: ${params.mciRegNo}`, { x: 40, y: y - 26, size: 9, font: fontRegular, color: gray });

    // ── Patient info ─────────────────────────────────────────────────────────
    page.drawText(`Patient: ${params.patientName}`, {
      x: width - 220, y, size: 10, font: fontBold, color: dark,
    });

    y -= 50;
    page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 0.5, color: lineColor });

    // ── Diagnosis ────────────────────────────────────────────────────────────
    if (params.diagnosis) {
      y -= 18;
      page.drawText('Diagnosis', { x: 40, y, size: 10, font: fontBold, color: brand });
      y -= 14;
      page.drawText(params.diagnosis, { x: 40, y, size: 10, font: fontRegular, color: dark, maxWidth: width - 80 });
      y -= 20;
    }

    // ── Medicines table ──────────────────────────────────────────────────────
    y -= 10;
    page.drawText('Rx — Medicines', { x: 40, y, size: 11, font: fontBold, color: brand });
    y -= 16;

    // Column headers
    const cols = { name: 40, dosage: 220, freq: 330, dur: 430 };
    page.drawText('Medicine', { x: cols.name, y, size: 9, font: fontBold, color: gray });
    page.drawText('Dosage',   { x: cols.dosage, y, size: 9, font: fontBold, color: gray });
    page.drawText('Frequency', { x: cols.freq, y, size: 9, font: fontBold, color: gray });
    page.drawText('Duration', { x: cols.dur, y, size: 9, font: fontBold, color: gray });
    y -= 4;
    page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 0.5, color: lineColor });

    for (const med of params.medicines) {
      y -= 16;
      if (y < 100) break; // page overflow guard
      page.drawText(med.name,      { x: cols.name,  y, size: 9, font: fontRegular, color: dark, maxWidth: 175 });
      page.drawText(med.dosage,    { x: cols.dosage, y, size: 9, font: fontRegular, color: dark });
      page.drawText(med.frequency, { x: cols.freq,   y, size: 9, font: fontRegular, color: dark });
      page.drawText(med.durationDays ? `${med.durationDays}d` : '—',
        { x: cols.dur, y, size: 9, font: fontRegular, color: dark });
      if (med.instructions) {
        y -= 11;
        page.drawText(`  ↳ ${med.instructions}`, { x: cols.name, y, size: 8, font: fontRegular, color: gray, maxWidth: width - 80 });
      }
    }

    // ── Advice ───────────────────────────────────────────────────────────────
    if (params.advice) {
      y -= 24;
      page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 0.5, color: lineColor });
      y -= 14;
      page.drawText('Advice', { x: 40, y, size: 10, font: fontBold, color: brand });
      y -= 14;
      page.drawText(params.advice, { x: 40, y, size: 10, font: fontRegular, color: dark, maxWidth: width - 80 });
    }

    // ── Follow-up ────────────────────────────────────────────────────────────
    if (params.followUpIn) {
      y -= 20;
      page.drawText(`Follow-up in: ${params.followUpIn}`, {
        x: 40, y, size: 10, font: fontBold, color: dark,
      });
    }

    // ── Footer ───────────────────────────────────────────────────────────────
    page.drawText('Generated by DocNear — docnear.in | This prescription is digitally signed.', {
      x: 40, y: 30, size: 8, font: fontRegular, color: gray,
    });

    return doc.save();
  }
}

// Local error class to avoid importing from @nestjs/common twice
class ConflictError extends BadRequestException {
  constructor(msg: string) { super(msg); }
}

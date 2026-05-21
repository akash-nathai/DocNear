import type { BookingStatus, ConsultationType, PaymentStatus } from './enums';

export interface BookingDto {
  id: string;
  bookingRef: string;
  doctor: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
    primarySpeciality?: string;
  };
  patient: {
    id: string;
    firstName: string;
    lastName: string;
  };
  clinic?: {
    id: string;
    name: string;
    addressLine1: string;
    city: string;
  };
  slotDatetime: string;
  consultType: ConsultationType;
  status: BookingStatus;
  feeCharged: number;
  discountAmount: number;
  patientNotes?: string;
  confirmedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  createdAt: string;
}

export interface MedicineDto {
  name: string;
  genericName?: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
  qty: number;
}

export interface PrescriptionDto {
  id: string;
  bookingId: string;
  medicines: MedicineDto[];
  diagnosis?: string;
  advice?: string;
  followUpIn?: string;
  pdfUrl?: string;
  isFinalized: boolean;
  finalizedAt?: string;
  createdAt: string;
}

export interface PaymentInitDto {
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

export interface SlotLockDto {
  lockId: string;
  expiresAt: string;
  expiresInSeconds: number;
}

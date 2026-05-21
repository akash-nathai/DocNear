import type { DoctorStatus, ConsultationType } from './enums';

export interface SpecialityDto {
  id: string;
  name: string;
  slug: string;
  iconUrl?: string;
}

export interface ClinicDto {
  id: string;
  name: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  pincode: string;
  lat: number;
  lng: number;
  phone?: string;
  workingHours: Record<string, { open: string; close: string }>;
}

export interface DoctorProfileDto {
  id: string;
  userId: string;
  mciRegNo: string;
  qualifications: string[];
  bio?: string;
  experienceYears: number;
  gender?: string;
  languages: string[];
  consultationFeeClinic: number;
  consultationFeeOnline: number;
  slotDurationMinutes: number;
  verificationStatus: DoctorStatus;
  avgRating: number;
  totalReviews: number;
  totalConsultations: number;
  slug: string;
  specialities: Array<SpecialityDto & { isPrimary: boolean }>;
  clinics: ClinicDto[];
  createdAt: string;
}

export interface SlotDto {
  datetime: string;
  isAvailable: boolean;
  consultType: ConsultationType;
  clinicId?: string;
}

export interface SlotGroupDto {
  date: string;
  morning: SlotDto[];
  afternoon: SlotDto[];
  evening: SlotDto[];
}

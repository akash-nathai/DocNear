import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ConsultationType } from '@prisma/client';

export class CreateBookingDto {
  /** Doctor's URL slug (from GET /v1/doctors listing) */
  @IsString()
  doctorSlug!: string;

  /**
   * ISO 8601 UTC datetime of the chosen slot.
   * Must exactly match a slot returned by GET /v1/slots/:doctorSlug.
   * Example: "2026-05-25T09:00:00.000Z"
   */
  @IsDateString()
  slotDatetime!: string;

  @IsEnum(ConsultationType)
  consultType!: ConsultationType;

  /** Required when consultType = IN_CLINIC */
  @IsOptional()
  @IsUUID()
  clinicId?: string;

  /** UUID of family member to book for (omit to book for self) */
  @IsOptional()
  @IsUUID()
  familyMemberId?: string;

  /** Optional patient notes for the doctor */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  patientNotes?: string;

  /** Optional coupon code for discount */
  @IsOptional()
  @IsString()
  @MaxLength(30)
  couponCode?: string;
}

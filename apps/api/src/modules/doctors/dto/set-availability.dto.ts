import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ConsultationType } from '@prisma/client';

export class AvailabilityWindowDto {
  /** 0 = Sunday, 1 = Monday … 6 = Saturday */
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  /** 24-hour time "HH:MM" (UTC) */
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'startTime must be HH:MM (24h)' })
  startTime!: string;

  /** 24-hour time "HH:MM" (UTC), must be after startTime */
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'endTime must be HH:MM (24h)' })
  endTime!: string;

  @IsEnum(ConsultationType)
  consultType!: ConsultationType;

  /** Required when consultType = IN_CLINIC */
  @IsOptional()
  @IsUUID()
  clinicId?: string;
}

export class SetAvailabilityDto {
  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(42) // max 6 windows/day × 7 days
  @ValidateNested({ each: true })
  @Type(() => AvailabilityWindowDto)
  slots!: AvailabilityWindowDto[];
}

// ── Override ──────────────────────────────────────────────────────────────────

export class AddAvailabilityOverrideDto {
  /** Date in YYYY-MM-DD format (local date) */
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'overrideDate must be YYYY-MM-DD' })
  overrideDate!: string;

  /** true = entire day off; false = custom hours apply */
  @IsOptional()
  isDayOff?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  startTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  endTime?: string;

  @IsOptional()
  @IsUUID()
  clinicId?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

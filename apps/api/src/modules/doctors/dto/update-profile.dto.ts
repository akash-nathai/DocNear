import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * All fields optional — PATCH semantics.
 * mciRegNo and userId are immutable after onboarding.
 */
export class UpdateDoctorProfileDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  qualifications?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  experienceYears?: number;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  consultationFeeClinic?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  consultationFeeOnline?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(120)
  slotDurationMinutes?: number;
}

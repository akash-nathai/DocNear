import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateDoctorProfileDto {
  /** Medical Council of India registration number */
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  mciRegNo!: string;

  /** e.g. ['MBBS', 'MD (Medicine)'] */
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  qualifications!: string[];

  /** Short professional bio */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;

  /** Years of clinical experience */
  @IsInt()
  @Min(0)
  @Max(60)
  experienceYears!: number;

  /** MALE | FEMALE | OTHER */
  @IsOptional()
  @IsString()
  gender?: string;

  /** e.g. ['English', 'Hindi'] — English is always included */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  /** In-clinic consultation fee in paise (1 INR = 100 paise) */
  @IsInt()
  @Min(0)
  consultationFeeClinic!: number;

  /** Online/video consultation fee in paise */
  @IsInt()
  @Min(0)
  consultationFeeOnline!: number;

  /** Slot duration in minutes (default 15) */
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(120)
  slotDurationMinutes?: number;
}

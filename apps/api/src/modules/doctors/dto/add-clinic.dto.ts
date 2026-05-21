import {
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class AddClinicDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(200)
  addressLine1!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine2?: string;

  /** UUID of city from /v1/cities */
  @IsUUID()
  cityId!: string;

  /** Indian PIN code */
  @IsString()
  @Matches(/^\d{6}$/, { message: 'pincode must be 6 digits' })
  pincode!: string;

  /** Latitude (WGS84) */
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  /** Longitude (WGS84) */
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  /** Contact phone for the clinic */
  @IsOptional()
  @IsString()
  phone?: string;

  /**
   * Working hours as a JSON object.
   * Example: { "MON": "09:00-18:00", "TUE": "09:00-18:00", ... }
   */
  @IsOptional()
  @IsObject()
  workingHours?: Record<string, string>;
}

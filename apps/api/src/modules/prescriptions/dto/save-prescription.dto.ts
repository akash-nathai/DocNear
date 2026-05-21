import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class MedicineItemDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsString()
  @MaxLength(100)
  dosage!: string;

  @IsString()
  @MaxLength(100)
  frequency!: string;

  @IsOptional()
  @IsNumber()
  durationDays?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  instructions?: string;
}

export class SavePrescriptionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MedicineItemDto)
  medicines!: MedicineItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  diagnosis?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  advice?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  followUpIn?: string; // e.g. "2 weeks", "1 month"
}

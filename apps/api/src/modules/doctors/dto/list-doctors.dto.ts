import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ConsultationType } from '@prisma/client';

export class ListDoctorsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 12;

  /** Filter by city UUID */
  @IsOptional()
  @IsUUID()
  cityId?: string;

  /** Filter by speciality UUID */
  @IsOptional()
  @IsUUID()
  specialityId?: string;

  /** Free-text search on doctor name / bio */
  @IsOptional()
  @IsString()
  q?: string;

  /** Filter by consult type (IN_CLINIC | VIDEO | HOME_VISIT) */
  @IsOptional()
  @IsEnum(ConsultationType)
  consultType?: ConsultationType;

  /** Sort field */
  @IsOptional()
  @IsEnum(['rating', 'experience', 'fee'])
  sortBy?: 'rating' | 'experience' | 'fee';

  /** Sort direction */
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}

import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { BookingStatus } from '@prisma/client';

export class ListBookingsDto {
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
  limit: number = 10;

  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  /** Filter from this date (inclusive) — YYYY-MM-DD */
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  /** Filter until this date (inclusive) — YYYY-MM-DD */
  @IsOptional()
  @IsDateString()
  toDate?: string;
}

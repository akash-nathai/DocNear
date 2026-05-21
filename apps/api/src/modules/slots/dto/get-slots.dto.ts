import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { ConsultationType } from '@prisma/client';

export class GetSlotsDto {
  /**
   * Date in YYYY-MM-DD format (local calendar date).
   * The server treats it as the calendar date in UTC (no TZ conversion).
   * Production apps should send the user's local date, not UTC midnight.
   */
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date!: string;

  /** Optional filter — return only slots of this consultation type */
  @IsOptional()
  @IsEnum(ConsultationType)
  consultType?: ConsultationType;
}

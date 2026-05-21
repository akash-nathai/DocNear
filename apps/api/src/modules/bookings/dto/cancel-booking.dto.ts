import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelBookingDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

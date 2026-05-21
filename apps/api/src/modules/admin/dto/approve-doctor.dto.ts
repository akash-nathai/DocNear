import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ApproveDoctorDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class RejectDoctorDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

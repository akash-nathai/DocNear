import { IsEnum } from 'class-validator';
import { ConsultationStatus } from '@prisma/client';

export class UpdateConsultationStatusDto {
  @IsEnum(ConsultationStatus)
  status!: ConsultationStatus;
}

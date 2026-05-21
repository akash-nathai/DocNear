import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ConsultationsService } from './consultations.service';
import { UpdateConsultationStatusDto } from './dto/update-status.dto';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

@Controller('consultations')
export class ConsultationsController {
  constructor(private readonly consultationsService: ConsultationsService) {}

  /**
   * POST /v1/consultations/:bookingId/join
   * Returns the video room code for the current user's role.
   * Enforces ±15-minute time window.
   */
  @Post(':bookingId/join')
  joinRoom(
    @CurrentUser() user: RequestUser,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ) {
    return this.consultationsService.joinRoom(bookingId, user.id, user.role);
  }

  /**
   * GET /v1/consultations/:bookingId
   * Returns the consultation record.
   */
  @Get(':bookingId')
  getConsultation(
    @CurrentUser() user: RequestUser,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ) {
    return this.consultationsService.getConsultation(bookingId, user.id, user.role);
  }

  /**
   * PATCH /v1/consultations/:bookingId/status
   * Doctor-only: advance consultation status (WAITING → ACTIVE → COMPLETED).
   */
  @Patch(':bookingId/status')
  updateStatus(
    @CurrentUser() user: RequestUser,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body() dto: UpdateConsultationStatusDto,
  ) {
    return this.consultationsService.updateStatus(bookingId, user.id, user.role, dto);
  }
}

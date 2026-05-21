import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { PrescriptionsService } from './prescriptions.service';
import { SavePrescriptionDto } from './dto/save-prescription.dto';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

@Controller('prescriptions')
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  /**
   * GET /v1/prescriptions/:bookingId
   * Returns the prescription (PHI decrypted) + signed PDF URL if finalized.
   */
  @Get(':bookingId')
  get(
    @CurrentUser() user: RequestUser,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ) {
    return this.prescriptionsService.get(bookingId, user.id, user.role);
  }

  /**
   * PUT /v1/prescriptions/:bookingId
   * Doctor creates/updates prescription draft (PHI encrypted in DB).
   */
  @Put(':bookingId')
  save(
    @CurrentUser() user: RequestUser,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body() dto: SavePrescriptionDto,
  ) {
    return this.prescriptionsService.save(bookingId, user.id, dto);
  }

  /**
   * POST /v1/prescriptions/:bookingId/finalize
   * Doctor locks the prescription, generates PDF, uploads to S3, notifies patient.
   */
  @Post(':bookingId/finalize')
  @HttpCode(HttpStatus.OK)
  finalize(
    @CurrentUser() user: RequestUser,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ) {
    return this.prescriptionsService.finalize(bookingId, user.id);
  }
}

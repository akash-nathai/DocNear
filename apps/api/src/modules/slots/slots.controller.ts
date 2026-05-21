import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { GetSlotsDto } from './dto/get-slots.dto';
import { SlotsService } from './slots.service';

@Controller('slots')
export class SlotsController {
  constructor(private readonly slots: SlotsService) {}

  /**
   * GET /v1/slots/:doctorSlug?date=YYYY-MM-DD&consultType=...
   *
   * Returns the full slot grid for a doctor on a given date, with
   * `available: true/false` for each slot. No authentication required —
   * patients browse slots before logging in.
   *
   * Example:
   *   GET /v1/slots/dr-rahul-sharma?date=2026-05-25&consultType=IN_CLINIC
   */
  @Public()
  @Get(':doctorSlug')
  getSlots(
    @Param('doctorSlug') doctorSlug: string,
    @Query() dto: GetSlotsDto,
  ) {
    return this.slots.getSlots(doctorSlug, dto);
  }
}

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ListBookingsDto } from './dto/list-bookings.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  /**
   * POST /v1/bookings
   * Patient creates a new booking (returns booking + Razorpay payment info).
   */
  @Post()
  async createBooking(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateBookingDto,
  ) {
    return this.bookingsService.createBooking(user.id, dto);
  }

  /**
   * GET /v1/bookings
   * List bookings for the authenticated user.
   * Patients see their own bookings; doctors see bookings for their profile.
   */
  @Get()
  async listBookings(
    @CurrentUser() user: RequestUser,
    @Query() dto: ListBookingsDto,
  ) {
    return this.bookingsService.listBookings(user.id, user.role, dto);
  }

  /**
   * GET /v1/bookings/:id
   * Get a single booking by ID.
   * Patient or doctor owning the booking can view it; admins can view all.
   */
  @Get(':id')
  async getBooking(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bookingsService.getBooking(user.id, user.role, id);
  }

  /**
   * POST /v1/bookings/:id/cancel
   * Cancel a booking.
   * Patients can cancel PENDING_PAYMENT or CONFIRMED bookings.
   * Doctors can cancel CONFIRMED bookings only.
   * Admins can cancel any non-terminal booking.
   */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelBooking(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelBookingDto,
  ) {
    return this.bookingsService.cancelBooking(user.id, user.role, id, dto);
  }
}

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingExpiryProcessor } from './processors/booking-expiry.processor';
import { BookingsGateway } from './bookings.gateway';
import { BOOKING_EXPIRY_QUEUE } from './bookings.constants';

@Module({
  imports: [
    BullModule.registerQueue({
      name: BOOKING_EXPIRY_QUEUE,
    }),
  ],
  controllers: [BookingsController],
  providers: [BookingsService, BookingExpiryProcessor, BookingsGateway],
  exports: [BookingsService, BookingsGateway],
})
export class BookingsModule {}

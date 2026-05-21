import { IsUUID } from 'class-validator';

export class CreateOrderDto {
  /** UUID of the PENDING_PAYMENT booking to pay for */
  @IsUUID()
  bookingId!: string;
}

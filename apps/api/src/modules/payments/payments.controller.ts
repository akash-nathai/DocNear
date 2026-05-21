import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  RawBodyRequest,
  Req,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * POST /v1/payments/orders
   * Create a Razorpay order for a PENDING_PAYMENT booking.
   * Returns: { orderId, amountPaise, currency, keyId }
   */
  @Post('orders')
  async createOrder(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateOrderDto,
  ) {
    return this.paymentsService.createOrder(dto.bookingId, user.id);
  }

  /**
   * POST /v1/payments/webhook
   * Razorpay webhook endpoint — must be @Public (no JWT required).
   * Requires raw body for HMAC signature verification.
   *
   * Razorpay sends X-Razorpay-Signature header.
   */
  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing X-Razorpay-Signature header');
    }
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Raw body unavailable — ensure rawBody:true in NestFactory');
    }
    await this.paymentsService.handleWebhook(rawBody, signature);
    return { received: true };
  }

  /**
   * GET /v1/payments/:bookingId
   * Get payment details for a booking (patient or doctor access).
   */
  @Get(':bookingId')
  async getPayment(
    @CurrentUser() user: RequestUser,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ) {
    return this.paymentsService.getPayment(bookingId, user.id, user.role);
  }
}

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PharmacyService } from './pharmacy.service';
import { ListProductsDto } from './dto/list-products.dto';
import { CreatePharmacyOrderDto } from './dto/create-order.dto';
import { IsEnum } from 'class-validator';
import { PharmacyOrderStatus } from '@prisma/client';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Role } from '@docnear/shared-types';
import type { RequestUser } from '../auth/strategies/jwt.strategy';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

class UpdateOrderStatusDto {
  @IsEnum(PharmacyOrderStatus)
  status!: PharmacyOrderStatus;
}

class PaginationQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  limit: number = 10;
}

@Controller('pharmacy')
export class PharmacyController {
  constructor(private readonly pharmacyService: PharmacyService) {}

  // ── Public-ish (authenticated) product endpoints ──────────────────────────

  /** GET /v1/pharmacy/categories */
  @Get('categories')
  listCategories() {
    return this.pharmacyService.listCategories();
  }

  /** GET /v1/pharmacy/products */
  @Get('products')
  listProducts(@Query() dto: ListProductsDto) {
    return this.pharmacyService.listProducts(dto);
  }

  /** GET /v1/pharmacy/products/:id */
  @Get('products/:id')
  getProduct(@Param('id', ParseUUIDPipe) id: string) {
    return this.pharmacyService.getProduct(id);
  }

  // ── Patient order endpoints ───────────────────────────────────────────────

  /** POST /v1/pharmacy/orders */
  @Post('orders')
  createOrder(@CurrentUser() user: RequestUser, @Body() dto: CreatePharmacyOrderDto) {
    return this.pharmacyService.createOrder(user.id, dto);
  }

  /** GET /v1/pharmacy/orders */
  @Get('orders')
  listMyOrders(@CurrentUser() user: RequestUser, @Query() q: PaginationQuery) {
    return this.pharmacyService.listMyOrders(user.id, q.page, q.limit);
  }

  /** GET /v1/pharmacy/orders/:id */
  @Get('orders/:id')
  getOrder(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.pharmacyService.getOrder(user.id, user.role, id);
  }

  // ── Admin: update order status ────────────────────────────────────────────

  /** PATCH /v1/pharmacy/orders/:id/status (SUPER_ADMIN only) */
  @Patch('orders/:id/status')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  updateOrderStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.pharmacyService.updateOrderStatus(id, dto.status);
  }
}

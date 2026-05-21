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
import { AdminService } from './admin.service';
import { ApproveDoctorDto, RejectDoctorDto } from './dto/approve-doctor.dto';
import { CreateCouponDto, UpdateCouponDto } from './dto/manage-coupon.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Role } from '@docnear/shared-types';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

@Controller('admin')
@UseGuards(RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ── Dashboard ──────────────────────────────────────────────────────────────

  /** GET /v1/admin/stats */
  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  // ── Doctor approval ────────────────────────────────────────────────────────

  /** PATCH /v1/admin/doctors/:userId/approve */
  @Patch('doctors/:userId/approve')
  @HttpCode(HttpStatus.OK)
  approveDoctor(
    @CurrentUser() actor: RequestUser,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: ApproveDoctorDto,
  ) {
    return this.adminService.approveDoctor(userId, actor.id, dto);
  }

  /** PATCH /v1/admin/doctors/:userId/reject */
  @Patch('doctors/:userId/reject')
  @HttpCode(HttpStatus.OK)
  rejectDoctor(
    @CurrentUser() actor: RequestUser,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: RejectDoctorDto,
  ) {
    return this.adminService.rejectDoctor(userId, actor.id, dto);
  }

  // ── Users ──────────────────────────────────────────────────────────────────

  /** GET /v1/admin/users */
  @Get('users')
  listUsers(@Query() dto: ListUsersDto) {
    return this.adminService.listUsers(dto);
  }

  /** PATCH /v1/admin/users/:userId/suspend */
  @Patch('users/:userId/suspend')
  @HttpCode(HttpStatus.OK)
  suspendUser(
    @CurrentUser() actor: RequestUser,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.adminService.suspendUser(userId, actor.id);
  }

  // ── Specialities ───────────────────────────────────────────────────────────

  /** GET /v1/admin/specialities */
  @Get('specialities')
  listSpecialities() {
    return this.adminService.listSpecialities();
  }

  /** POST /v1/admin/specialities */
  @Post('specialities')
  createSpeciality(
    @Body() body: { name: string; slug: string; description?: string; iconUrl?: string },
  ) {
    return this.adminService.createSpeciality(body);
  }

  /** PATCH /v1/admin/specialities/:id */
  @Patch('specialities/:id')
  updateSpeciality(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { name?: string; isActive?: boolean; sortOrder?: number },
  ) {
    return this.adminService.updateSpeciality(id, body);
  }

  // ── Cities ─────────────────────────────────────────────────────────────────

  /** GET /v1/admin/cities */
  @Get('cities')
  listCities() {
    return this.adminService.listCities();
  }

  /** PATCH /v1/admin/cities/:id */
  @Patch('cities/:id')
  updateCity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { isActive?: boolean },
  ) {
    return this.adminService.updateCity(id, body);
  }

  // ── Coupons ────────────────────────────────────────────────────────────────

  /** GET /v1/admin/coupons */
  @Get('coupons')
  listCoupons() {
    return this.adminService.listCoupons();
  }

  /** POST /v1/admin/coupons */
  @Post('coupons')
  createCoupon(@Body() dto: CreateCouponDto) {
    return this.adminService.createCoupon(dto);
  }

  /** PATCH /v1/admin/coupons/:id */
  @Patch('coupons/:id')
  updateCoupon(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCouponDto,
  ) {
    return this.adminService.updateCoupon(id, dto);
  }

  // ── Audit logs ──────────────────────────────────────────────────────────────

  /** GET /v1/admin/audit-logs */
  @Get('audit-logs')
  listAuditLogs(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.listAuditLogs(page ?? 1, limit ?? 50);
  }

  // ── Payouts ────────────────────────────────────────────────────────────────

  /** GET /v1/admin/payouts/pending */
  @Get('payouts/pending')
  listPendingPayouts() {
    return this.adminService.listPendingPayouts();
  }

  /** PATCH /v1/admin/payouts/:doctorId/mark-paid */
  @Patch('payouts/:doctorId/mark-paid')
  @HttpCode(HttpStatus.OK)
  markPaidOut(
    @CurrentUser() actor: RequestUser,
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
  ) {
    return this.adminService.markPaidOut(doctorId, actor.id);
  }
}

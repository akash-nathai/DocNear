import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@docnear/shared-types';
import { CurrentUser, RequestUser } from '../../core/decorators/current-user.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Public } from '../auth/decorators/public.decorator';
import { AddBankAccountDto } from './dto/add-bank-account.dto';
import { AddClinicDto } from './dto/add-clinic.dto';
import {
  AddAvailabilityOverrideDto,
  SetAvailabilityDto,
} from './dto/set-availability.dto';
import { CreateDoctorProfileDto } from './dto/create-profile.dto';
import { UpdateDoctorProfileDto } from './dto/update-profile.dto';
import { ListDoctorsDto } from './dto/list-doctors.dto';
import { DoctorsService } from './doctors.service';

@Controller('doctors')
export class DoctorsController {
  constructor(private readonly doctors: DoctorsService) {}

  // ── Public ────────────────────────────────────────────────────────────────

  /** GET /v1/doctors — paginated, filterable doctor listing */
  @Public()
  @Get()
  list(@Query() query: ListDoctorsDto) {
    return this.doctors.listDoctors(query);
  }

  /** GET /v1/doctors/:slug — public doctor profile */
  @Public()
  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.doctors.getDoctorBySlug(slug);
  }

  // ── Doctor-only ───────────────────────────────────────────────────────────

  /**
   * POST /v1/doctors/onboard — one-time doctor profile creation.
   * Called after registration; doctor provides MCI reg, qualifications, fees.
   */
  @UseGuards(RolesGuard)
  @Roles(Role.DOCTOR)
  @Post('onboard')
  onboard(@CurrentUser() user: RequestUser, @Body() dto: CreateDoctorProfileDto) {
    return this.doctors.onboard(user.id, dto);
  }

  /** GET /v1/doctors/me — own full profile */
  @UseGuards(RolesGuard)
  @Roles(Role.DOCTOR)
  @Get('me')
  getMe(@CurrentUser() user: RequestUser) {
    return this.doctors.getMyProfile(user.id);
  }

  /** PATCH /v1/doctors/me — update own profile fields */
  @UseGuards(RolesGuard)
  @Roles(Role.DOCTOR)
  @Patch('me')
  updateMe(@CurrentUser() user: RequestUser, @Body() dto: UpdateDoctorProfileDto) {
    return this.doctors.updateMyProfile(user.id, dto);
  }

  // ── Bank account ──────────────────────────────────────────────────────────

  /** POST /v1/doctors/me/bank-account — add/update encrypted bank account */
  @UseGuards(RolesGuard)
  @Roles(Role.DOCTOR)
  @Post('me/bank-account')
  addBankAccount(@CurrentUser() user: RequestUser, @Body() dto: AddBankAccountDto) {
    return this.doctors.addBankAccount(user.id, dto);
  }

  // ── Clinics ───────────────────────────────────────────────────────────────

  /** POST /v1/doctors/me/clinics */
  @UseGuards(RolesGuard)
  @Roles(Role.DOCTOR)
  @Post('me/clinics')
  addClinic(@CurrentUser() user: RequestUser, @Body() dto: AddClinicDto) {
    return this.doctors.addClinic(user.id, dto);
  }

  /** PATCH /v1/doctors/me/clinics/:id */
  @UseGuards(RolesGuard)
  @Roles(Role.DOCTOR)
  @Patch('me/clinics/:id')
  updateClinic(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) clinicId: string,
    @Body() dto: AddClinicDto,
  ) {
    return this.doctors.updateClinic(user.id, clinicId, dto);
  }

  /** DELETE /v1/doctors/me/clinics/:id — soft delete */
  @UseGuards(RolesGuard)
  @Roles(Role.DOCTOR)
  @Delete('me/clinics/:id')
  deleteClinic(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) clinicId: string,
  ) {
    return this.doctors.deleteClinic(user.id, clinicId);
  }

  // ── Availability ──────────────────────────────────────────────────────────

  /** GET /v1/doctors/me/availability */
  @UseGuards(RolesGuard)
  @Roles(Role.DOCTOR)
  @Get('me/availability')
  getAvailability(@CurrentUser() user: RequestUser) {
    return this.doctors.getAvailability(user.id);
  }

  /**
   * POST /v1/doctors/me/availability — replaces full weekly schedule.
   * Send empty array to clear all availability.
   */
  @UseGuards(RolesGuard)
  @Roles(Role.DOCTOR)
  @Post('me/availability')
  setAvailability(@CurrentUser() user: RequestUser, @Body() dto: SetAvailabilityDto) {
    return this.doctors.setAvailability(user.id, dto);
  }

  /** POST /v1/doctors/me/availability/overrides */
  @UseGuards(RolesGuard)
  @Roles(Role.DOCTOR)
  @Post('me/availability/overrides')
  addOverride(
    @CurrentUser() user: RequestUser,
    @Body() dto: AddAvailabilityOverrideDto,
  ) {
    return this.doctors.addOverride(user.id, dto);
  }

  /** DELETE /v1/doctors/me/availability/overrides/:id */
  @UseGuards(RolesGuard)
  @Roles(Role.DOCTOR)
  @Delete('me/availability/overrides/:id')
  deleteOverride(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) overrideId: string,
  ) {
    return this.doctors.deleteOverride(user.id, overrideId);
  }
}

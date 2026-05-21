import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { PatientsService } from './patients.service';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { CreateFamilyMemberDto } from './dto/create-family-member.dto';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  /** GET /v1/patients/me */
  @Get('me')
  getMyProfile(@CurrentUser() user: RequestUser) {
    return this.patientsService.getMyProfile(user.id);
  }

  /** PATCH /v1/patients/me */
  @Patch('me')
  updateMyProfile(@CurrentUser() user: RequestUser, @Body() dto: UpdatePatientDto) {
    return this.patientsService.updateMyProfile(user.id, dto);
  }

  /** GET /v1/patients/me/family-members */
  @Get('me/family-members')
  listFamilyMembers(@CurrentUser() user: RequestUser) {
    return this.patientsService.listFamilyMembers(user.id);
  }

  /** POST /v1/patients/me/family-members */
  @Post('me/family-members')
  addFamilyMember(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateFamilyMemberDto,
  ) {
    return this.patientsService.addFamilyMember(user.id, dto);
  }

  /** DELETE /v1/patients/me/family-members/:id */
  @Delete('me/family-members/:id')
  @HttpCode(HttpStatus.OK)
  removeFamilyMember(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.patientsService.removeFamilyMember(user.id, id);
  }
}

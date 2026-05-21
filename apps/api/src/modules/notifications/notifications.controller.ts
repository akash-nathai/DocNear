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
  Query,
} from '@nestjs/common';
import { IsEnum, IsString, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

class RegisterTokenDto {
  @IsString()
  token!: string;

  @IsEnum(['android', 'ios', 'web'])
  platform!: 'android' | 'ios' | 'web';
}

class ListNotificationsQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  limit: number = 20;
}

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /** GET /v1/notifications */
  @Get()
  list(@CurrentUser() user: RequestUser, @Query() q: ListNotificationsQuery) {
    return this.notificationsService.listNotifications(user.id, q.page, q.limit);
  }

  /** PATCH /v1/notifications/:id/read */
  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markRead(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notificationsService.markRead(user.id, id);
  }

  /** PATCH /v1/notifications/read-all */
  @Patch('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  markAllRead(@CurrentUser() user: RequestUser) {
    return this.notificationsService.markAllRead(user.id);
  }

  /**
   * POST /v1/notifications/device-token
   * Mobile app calls this after login to register its FCM token.
   */
  @Post('device-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  registerToken(@CurrentUser() user: RequestUser, @Body() dto: RegisterTokenDto) {
    return this.notificationsService.registerDeviceToken(user.id, dto.token, dto.platform);
  }

  /**
   * DELETE /v1/notifications/device-token/:token
   * Mobile app calls this on logout to stop receiving push notifications.
   */
  @Delete('device-token/:token')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeToken(@Param('token') token: string) {
    return this.notificationsService.removeDeviceToken(token);
  }
}

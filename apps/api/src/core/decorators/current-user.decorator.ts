import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';
import type { RequestUser } from '../../modules/auth/strategies/jwt.strategy';

export type { RequestUser };

/**
 * @CurrentUser() — injects the authenticated user from req.user.
 * Populated by JwtStrategy after access-token validation.
 *
 * Usage: `@CurrentUser() user: RequestUser`
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    const request = ctx.switchToHttp().getRequest<Request & { user: RequestUser }>();
    return request.user;
  },
);

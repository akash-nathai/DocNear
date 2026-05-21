import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core'; // value import — required for NestJS DI
import type { Role } from '@docnear/shared-types';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { RequestUser } from '../decorators/current-user.decorator';
import type { Request } from 'express';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user: RequestUser }>();
    const user = request.user;

    if (!user) return false;

    return requiredRoles.some((role) => user.role === role);
  }
}

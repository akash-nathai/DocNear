import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JwtRefreshGuard — validates the httpOnly refresh cookie.
 * Used only on POST /auth/refresh and POST /auth/logout.
 */
@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {}

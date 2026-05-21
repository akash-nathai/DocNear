import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface RefreshTokenPayload {
  /** Subject — user UUID */
  sub: string;
  /** JWT ID — stored in Redis for revocation checks */
  jti: string;
  iat: number;
  exp: number;
}

export interface RequestRefreshUser extends RefreshTokenPayload {
  /** Raw JWT string extracted from the cookie (passed to AuthService.refresh) */
  refreshToken: string;
}

/**
 * JwtRefreshStrategy — validates the httpOnly refresh cookie.
 * Attaches { sub, jti, refreshToken } to req.user on success.
 * Used only by the refresh and logout endpoints.
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(config: ConfigService) {
    const secret = config.get<string>('jwt.refreshSecret');
    if (!secret) throw new Error('JWT_REFRESH_SECRET is not configured');

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          const token = (req?.cookies as Record<string, unknown>)?.['refresh_token'];
          return typeof token === 'string' ? token : null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: RefreshTokenPayload): RequestRefreshUser {
    const refreshToken = (req.cookies as Record<string, string>)['refresh_token'] ?? '';
    return { ...payload, refreshToken };
  }
}

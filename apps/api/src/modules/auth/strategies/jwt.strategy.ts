import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Role } from '@prisma/client';

export interface AccessTokenPayload {
  /** Subject — user UUID */
  sub: string;
  role: Role;
  iat: number;
  exp: number;
}

export interface RequestUser {
  id: string;
  role: Role;
}

/**
 * JwtStrategy — validates the Bearer access token on every protected request.
 * On success, sets req.user = { id, role }.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    const secret = config.get<string>('jwt.accessSecret');
    if (!secret) throw new Error('JWT_ACCESS_SECRET is not configured');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: AccessTokenPayload): RequestUser {
    if (!payload.sub || !payload.role) {
      throw new UnauthorizedException('Invalid token payload');
    }
    return { id: payload.sub, role: payload.role };
  }
}

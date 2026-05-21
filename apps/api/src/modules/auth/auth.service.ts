import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { Redis } from 'ioredis';
import { REDIS_KEYS } from '../../common/constants';
import { CryptoService } from '../../core/crypto/crypto.service';
import { PrismaService } from '../../core/database/prisma.service';
import { REDIS_CLIENT } from '../../core/redis/redis.constants';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RequestUser } from './strategies/jwt.strategy';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SafeUser {
  id: string;
  role: Role;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  status: UserStatus;
}

export interface TokenPair {
  accessToken: string;
  /** Raw refresh JWT — caller is responsible for setting it as an httpOnly cookie */
  refreshToken: string;
}

export interface GoogleProfile {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse a JWT duration string ('15m', '7d', …) to seconds.
 * Supports s / m / h / d / w units.
 */
function durationToSeconds(duration: string): number {
  const match = /^(\d+)([smhdw])$/.exec(duration);
  if (!match) return 604_800; // fallback: 7 days
  const units: Record<string, number> = { s: 1, m: 60, h: 3_600, d: 86_400, w: 604_800 };
  return parseInt(match[1]!, 10) * (units[match[2]!] ?? 1);
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly crypto: CryptoService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  // ── Register ──────────────────────────────────────────────────────────────

  async register(dto: RegisterDto): Promise<{ user: SafeUser } & TokenPair> {
    const emailHash = this.crypto.hashEmail(dto.email);
    const phoneHash = this.crypto.hashPhone(dto.phone);

    // Uniqueness checks (hash columns have unique indexes)
    const [emailExists, phoneExists] = await Promise.all([
      this.prisma.user.findUnique({ where: { emailHash } }),
      this.prisma.user.findUnique({ where: { phoneHash } }),
    ]);

    if (emailExists) throw new ConflictException('Email is already registered');
    if (phoneExists) throw new ConflictException('Phone number is already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const emailEnc = this.crypto.encrypt(dto.email);

    // Patients auto-approved; doctors start PENDING (require admin verification)
    const status: UserStatus =
      dto.role === 'PATIENT' ? UserStatus.APPROVED : UserStatus.PENDING;

    const user = await this.prisma.user.create({
      data: {
        id: randomUUID(),
        emailEnc,
        emailHash,
        phoneEnc: this.crypto.encrypt(dto.phone),
        phoneHash,
        passwordHash,
        role: dto.role as Role,
        status,
        firstName: dto.firstName,
        lastName: dto.lastName,
      },
    });

    // Create profile stub based on role
    if (dto.role === 'PATIENT') {
      await this.prisma.patientProfile.create({
        data: { id: randomUUID(), userId: user.id },
      });
    }
    // Doctor profile is created during the doctor onboarding flow (Phase 5)

    // Queue email verification (log token in dev; send via email in Phase 7)
    await this.createEmailVerification(user.id);

    this.logger.log(`Registered ${dto.role} user: ${user.id}`);
    return this.generateTokens(user);
  }

  // ── Login ─────────────────────────────────────────────────────────────────

  async login(dto: LoginDto): Promise<{ user: SafeUser } & TokenPair> {
    const emailHash = this.crypto.hashEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { emailHash } });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException('Your account has been suspended. Please contact support.');
    }

    if (user.status === UserStatus.PENDING) {
      throw new ForbiddenException('Your account is pending verification.');
    }

    if (user.status === UserStatus.REJECTED) {
      throw new ForbiddenException('Your account application was rejected.');
    }

    // Update lastLoginAt
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    this.logger.log(`Login: user ${user.id} (${user.role})`);
    return this.generateTokens(user);
  }

  // ── Refresh ───────────────────────────────────────────────────────────────

  async refresh(userId: string, jti: string): Promise<TokenPair> {
    // Verify JTI still in Redis (revocation check)
    const stored = await this.redis.get(REDIS_KEYS.session(jti));
    if (!stored) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== UserStatus.APPROVED) {
      throw new UnauthorizedException('User is not active');
    }

    // Revoke old JTI before issuing new tokens (token rotation)
    await this.redis.del(REDIS_KEYS.session(jti));

    const tokens = await this.generateTokens(user);
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  // ── Logout ────────────────────────────────────────────────────────────────

  async logout(jti: string): Promise<void> {
    await this.redis.del(REDIS_KEYS.session(jti));
    this.logger.log(`Logout: revoked JTI ${jti}`);
  }

  // ── Forgot password ───────────────────────────────────────────────────────

  async forgotPassword(email: string): Promise<void> {
    const emailHash = this.crypto.hashEmail(email);
    const user = await this.prisma.user.findUnique({ where: { emailHash } });

    // Never reveal whether email exists — always return 200
    if (!user || !user.passwordHash) return;

    // Invalidate existing unused tokens for this user
    await this.prisma.passwordReset.deleteMany({
      where: { userId: user.id, usedAt: null },
    });

    const token = this.crypto.generateToken(32);
    const tokenHash = this.crypto.hashToken(token);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await this.prisma.passwordReset.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    // In production: send email with reset link
    // In development: log the token
    if (this.config.get<string>('nodeEnv') !== 'production') {
      this.logger.warn(`[DEV] Password reset token for ${user.id}: ${token}`);
    }
  }

  // ── Reset password ────────────────────────────────────────────────────────

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = this.crypto.hashToken(token);

    const reset = await this.prisma.passwordReset.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!reset) {
      throw new BadRequestException('Password reset token is invalid or has expired');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: reset.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordReset.update({
        where: { id: reset.id },
        data: { usedAt: new Date() },
      }),
    ]);

    // Revoke all active sessions for security
    // (In production you'd scan Redis keys by pattern; for now log the intent)
    this.logger.log(`Password reset complete for user ${reset.userId}`);
  }

  // ── Google OAuth ──────────────────────────────────────────────────────────

  async validateGoogleUser(profile: GoogleProfile): Promise<RequestUser> {
    const emailHash = this.crypto.hashEmail(profile.email);

    // Find existing user (by Google ID or by email hash)
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { googleId: profile.googleId },
          { emailHash },
        ],
      },
    });

    if (!user) {
      // Auto-create as patient; doctor Google sign-up goes through onboarding
      user = await this.prisma.user.create({
        data: {
          id: randomUUID(),
          googleId: profile.googleId,
          emailEnc: this.crypto.encrypt(profile.email),
          emailHash,
          role: Role.PATIENT,
          status: UserStatus.APPROVED,
          firstName: profile.firstName,
          lastName: profile.lastName,
          avatarUrl: profile.avatarUrl,
          emailVerified: true, // Google-verified email
        },
      });

      await this.prisma.patientProfile.create({
        data: { id: randomUUID(), userId: user.id },
      });
    } else if (!user.googleId) {
      // Link Google ID to existing email account
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { googleId: profile.googleId, emailVerified: true },
      });
    }

    if (user.status !== UserStatus.APPROVED) {
      throw new ForbiddenException('Account is not active');
    }

    return { id: user.id, role: user.role };
  }

  // ── Google tokens (after OAuth callback) ─────────────────────────────────

  async generateGoogleTokens(requestUser: RequestUser): Promise<TokenPair> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: requestUser.id },
    });
    const { accessToken, refreshToken } = await this.generateTokens(user);
    return { accessToken, refreshToken };
  }

  // ── Me (current user info) ────────────────────────────────────────────────

  async getMe(userId: string): Promise<SafeUser & { email: string }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const email = user.emailEnc ? this.crypto.decrypt(user.emailEnc) : '';
    return { ...this.safeUser(user), email };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async generateTokens(
    user: { id: string; role: Role; firstName: string; lastName: string; avatarUrl: string | null; emailVerified: boolean; status: UserStatus },
  ): Promise<{ user: SafeUser } & TokenPair> {
    const jti = randomUUID();

    const accessToken = this.jwtService.sign(
      { sub: user.id, role: user.role },
    );

    const refreshSecret = this.config.get<string>('jwt.refreshSecret')!;
    const refreshExpiresIn = this.config.get<string>('jwt.refreshExpiresIn') ?? '7d';

    const refreshToken = this.jwtService.sign(
      { sub: user.id, jti },
      { secret: refreshSecret, expiresIn: refreshExpiresIn },
    );

    // Store JTI in Redis with TTL
    const ttlSeconds = durationToSeconds(refreshExpiresIn);
    await this.redis.set(REDIS_KEYS.session(jti), user.id, 'EX', ttlSeconds);

    return {
      user: this.safeUser(user),
      accessToken,
      refreshToken,
    };
  }

  private safeUser(user: {
    id: string;
    role: Role;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    emailVerified: boolean;
    status: UserStatus;
  }): SafeUser {
    return {
      id: user.id,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerified,
      status: user.status,
    };
  }

  private async createEmailVerification(userId: string): Promise<void> {
    const token = this.crypto.generateToken(32);
    const tokenHash = this.crypto.hashToken(token);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await this.prisma.emailVerification.create({
      data: {
        id: randomUUID(),
        userId,
        tokenHash,
        expiresAt,
      },
    });

    if (this.config.get<string>('nodeEnv') !== 'production') {
      this.logger.warn(`[DEV] Email verification token for ${userId}: ${token}`);
    }
  }
}

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { RequestRefreshUser } from './strategies/jwt-refresh.strategy';
import { RequestUser } from './strategies/jwt.strategy';

@Controller('auth')
export class AuthController {
  /** Cookie max-age: 7 days in ms */
  private static readonly REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
  private static readonly REFRESH_COOKIE_NAME = 'refresh_token';

  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  // ── POST /v1/auth/register ────────────────────────────────────────────────

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { user, accessToken, refreshToken } = await this.authService.register(dto);
    this.setRefreshCookie(res, refreshToken);
    return { user, accessToken };
  }

  // ── POST /v1/auth/login ───────────────────────────────────────────────────

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { user, accessToken, refreshToken } = await this.authService.login(dto);
    this.setRefreshCookie(res, refreshToken);
    return { user, accessToken };
  }

  // ── POST /v1/auth/refresh ─────────────────────────────────────────────────

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request & { user: RequestRefreshUser },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { sub: userId, jti } = req.user;
    const { accessToken, refreshToken } = await this.authService.refresh(userId, jti);
    this.setRefreshCookie(res, refreshToken);
    return { accessToken };
  }

  // ── POST /v1/auth/logout ──────────────────────────────────────────────────

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request & { user: RequestRefreshUser },
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(req.user.jti);
    this.clearRefreshCookie(res);
  }

  // ── POST /v1/auth/forgot-password ─────────────────────────────────────────

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    // Always return the same message to avoid email enumeration
    return { message: 'If that email exists, a reset link has been sent.' };
  }

  // ── POST /v1/auth/reset-password ──────────────────────────────────────────

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.password);
    return { message: 'Password has been reset successfully.' };
  }

  // ── GET /v1/auth/me ───────────────────────────────────────────────────────

  @Get('me')
  async me(@CurrentUser() user: RequestUser) {
    return this.authService.getMe(user.id);
  }

  // ── GET /v1/auth/google ───────────────────────────────────────────────────

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('google')
  google() {
    // Guard redirects to Google — handler body never executes
  }

  // ── GET /v1/auth/google/callback ──────────────────────────────────────────

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('google/callback')
  async googleCallback(
    @Req() req: Request & { user: RequestUser },
    @Res() res: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.generateGoogleTokens(
      req.user,
    );
    this.setRefreshCookie(res, refreshToken);

    // Redirect to frontend with access token in query string
    // (client stores it in memory; URL is HTTPS so it's not logged in plaintext)
    const webOrigin =
      (this.config.get<string[]>('cors.origins') ?? ['http://localhost:3000'])[0] ??
      'http://localhost:3000';

    res.redirect(`${webOrigin}/auth/google/success?token=${accessToken}`);
  }

  // ── Cookie helpers ────────────────────────────────────────────────────────

  private setRefreshCookie(res: Response, refreshToken: string): void {
    const isProduction = this.config.get<string>('nodeEnv') === 'production';
    res.cookie(AuthController.REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      path: '/v1/auth', // restrict cookie to auth routes
      maxAge: AuthController.REFRESH_COOKIE_MAX_AGE_MS,
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(AuthController.REFRESH_COOKIE_NAME, { path: '/v1/auth' });
  }
}

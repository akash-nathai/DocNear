import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * GoogleAuthGuard — initiates / handles the Google OAuth 2.0 flow.
 * Used on GET /auth/google and GET /auth/google/callback.
 */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';

/**
 * GoogleStrategy — OAuth 2.0 via Google.
 * On success, find-or-creates a user and returns { id, role } as req.user.
 *
 * Requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL env vars.
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    const clientID = config.get<string>('google.clientId') ?? '';
    const clientSecret = config.get<string>('google.clientSecret') ?? '';
    const callbackURL =
      config.get<string>('google.callbackUrl') ??
      'http://localhost:4000/v1/auth/google/callback';

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: {
      id: string;
      displayName: string;
      name?: { givenName?: string; familyName?: string };
      emails?: Array<{ value: string }>;
      photos?: Array<{ value: string }>;
    },
    done: VerifyCallback,
  ): Promise<void> {
    const email = profile.emails?.[0]?.value ?? '';
    const firstName = profile.name?.givenName ?? profile.displayName.split(' ')[0] ?? '';
    const lastName = profile.name?.familyName ?? '';
    const avatarUrl = profile.photos?.[0]?.value;

    const user = await this.authService.validateGoogleUser({
      googleId: profile.id,
      email,
      firstName,
      lastName,
      avatarUrl,
    });

    done(null, user);
  }
}

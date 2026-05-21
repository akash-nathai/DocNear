import { SetMetadata } from '@nestjs/common';

/**
 * @Public() — marks a route as unauthenticated.
 * The global JwtAuthGuard checks for this metadata and skips JWT verification.
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

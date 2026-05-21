'use client';

/**
 * AuthProvider — on mount, attempts to silently refresh the access token
 * using the httpOnly refresh cookie. If successful, hydrates the Zustand
 * store. If it fails (no cookie, expired, revoked) the user is treated as
 * unauthenticated.
 */
import type { JSX } from 'react';
import { useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { useAuthStore, type AuthUser } from '@/lib/auth-store';

interface RefreshResponse {
  accessToken: string;
  user: AuthUser;
}

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  const { setAuth, clearAuth } = useAuthStore();

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        const res = await apiClient.post<RefreshResponse>('/auth/refresh', {});
        if (!cancelled) {
          setAuth(res.data.user, res.data.accessToken);
        }
      } catch {
        if (!cancelled) {
          clearAuth();
        }
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [setAuth, clearAuth]);

  return <>{children}</>;
}

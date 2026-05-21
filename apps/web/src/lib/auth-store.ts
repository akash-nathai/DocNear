/**
 * Zustand auth store.
 *
 * Access token is kept in-memory only — never persisted to localStorage or
 * cookies from the client side (only the httpOnly refresh token cookie is
 * persisted, set by the server).
 *
 * On page reload the token is gone; AuthProvider calls /auth/refresh
 * (which sends the cookie automatically) to re-hydrate.
 */
import { create } from 'zustand';
import type { UserRole } from '@docnear/shared-types';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isHydrating: boolean;

  setAuth: (user: AuthUser, accessToken: string) => void;
  clearAuth: () => void;
  setHydrating: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isHydrating: true,

  setAuth: (user, accessToken) => set({ user, accessToken, isHydrating: false }),
  clearAuth: () => set({ user: null, accessToken: null, isHydrating: false }),
  setHydrating: (v) => set({ isHydrating: v }),
}));

// Convenience selectors
export const selectUser = (s: AuthState) => s.user;
export const selectAccessToken = (s: AuthState) => s.accessToken;
export const selectIsAuthenticated = (s: AuthState) => s.user !== null;
export const selectIsHydrating = (s: AuthState) => s.isHydrating;

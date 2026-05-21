import { create } from 'zustand';

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  role: 'PATIENT' | 'DOCTOR' | 'SUPER_ADMIN';
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  setAuth: (user: AuthUser, token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  setAuth: (user, accessToken) => set({ user, accessToken }),
  clearAuth: () => set({ user: null, accessToken: null }),
}));

import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { useAuthStore } from '../store/auth';
import { api } from '../lib/api';
import type { AuthUser } from '../store/auth';

interface RefreshRes { accessToken: string; user: AuthUser }

export default function RootLayout() {
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    api.post<RefreshRes>('/auth/refresh', {})
      .then((res) => { setAuth(res.user, res.accessToken); })
      .catch(() => { router.replace('/(auth)/login' as never); });
  }, [setAuth]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)" />
    </Stack>
  );
}

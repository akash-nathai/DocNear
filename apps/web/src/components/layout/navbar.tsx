'use client';
import type { JSX } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useState } from 'react';
import { clsx } from 'clsx';
import { useAuthStore, selectUser, selectIsAuthenticated } from '@/lib/auth-store';
import { apiClient } from '@/lib/api-client';

export function Navbar(): JSX.Element {
  const t = useTranslations('Nav');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore(selectUser);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [menuOpen, setMenuOpen] = useState(false);

  const href = (path: string) => `/${locale}${path}`;

  const navLinks = [
    { label: t('findDoctors'), href: href('/find-doctors') },
    { label: t('blog'), href: href('/blog') },
  ];

  async function handleLogout() {
    try { await apiClient.post('/auth/logout', {}); } catch { /* ignore */ }
    clearAuth();
    router.push(href('/find-doctors'));
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 backdrop-blur-sm shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href={href('/find-doctors')} className="flex items-center gap-1">
          <span className="text-xl font-extrabold text-sky-500">Doc</span>
          <span className="text-xl font-extrabold text-gray-900">Near</span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                'text-sm font-medium transition-colors',
                pathname.startsWith(link.href) ? 'text-sky-600' : 'text-gray-600 hover:text-sky-500',
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Auth */}
        <div className="flex items-center gap-3">
          {isAuthenticated && user ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-600">
                  {user.name[0]?.toUpperCase() ?? 'U'}
                </span>
                <span className="hidden sm:block">{user.name.split(' ')[0]}</span>
                <svg className="h-3 w-3 text-gray-400" viewBox="0 0 12 12" fill="currentColor">
                  <path d="M6 8L1 3h10L6 8z" />
                </svg>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-gray-100 bg-white py-1 shadow-xl">
                  <Link href={href('/dashboard')} onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-sky-50 hover:text-sky-600">
                    {t('dashboard')}
                  </Link>
                  <Link href={href('/bookings')} onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-sky-50 hover:text-sky-600">
                    {t('bookings')}
                  </Link>
                  <div className="my-1 border-t border-gray-100" />
                  <button onClick={handleLogout}
                    className="block w-full px-4 py-2.5 text-left text-sm text-red-500 hover:bg-red-50">
                    {t('logout')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href={href('/login')}
                className="text-sm font-medium text-gray-600 hover:text-sky-500 transition">
                {t('login')}
              </Link>
              <Link href={href('/signup')}
                className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 transition">
                {t('signup')}
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

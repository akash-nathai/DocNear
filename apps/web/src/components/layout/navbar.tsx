'use client';

import type { JSX } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { cn } from '@/lib/utils';
import { useAuthStore, selectUser, selectIsAuthenticated } from '@/lib/auth-store';

export function Navbar(): JSX.Element {
  const t = useTranslations('Nav');
  const locale = useLocale();
  const pathname = usePathname();
  const user = useAuthStore(selectUser);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);

  const href = (path: string) =>
    locale === 'en' ? path : `/${locale}${path}`;

  const navLinks = [
    { label: t('findDoctors'), href: href('/find-doctors') },
    { label: t('blog'), href: href('/blog') },
    { label: t('pharmacy'), href: href('/pharmacy') },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href={href('/find-doctors')} className="flex items-center gap-2">
          <span className="text-xl font-bold text-sky-500">Doc</span>
          <span className="text-xl font-bold text-emerald-500">Near</span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'text-sm font-medium transition-colors',
                pathname.startsWith(link.href)
                  ? 'text-sky-600'
                  : 'text-gray-600 hover:text-gray-900',
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Auth actions */}
        <div className="flex items-center gap-3">
          {isAuthenticated && user ? (
            <>
              <Link
                href={href('/dashboard')}
                className="text-sm font-medium text-gray-700 hover:text-sky-600"
              >
                {t('dashboard')}
              </Link>
              <span className="text-sm text-gray-500">{user.name}</span>
            </>
          ) : (
            <>
              <Link
                href={href('/login')}
                className="text-sm font-medium text-gray-700 hover:text-sky-600"
              >
                {t('login')}
              </Link>
              <Link
                href={href('/signup')}
                className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600"
              >
                {t('signup')}
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

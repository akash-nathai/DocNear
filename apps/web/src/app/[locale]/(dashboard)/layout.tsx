'use client';
import type { JSX } from 'react';
import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { clsx } from 'clsx';
import { useAuthStore } from '@/lib/auth-store';

export default function DashboardLayout({ children }: { children: React.ReactNode }): JSX.Element {
  const user = useAuthStore((s) => s.user);
  const isHydrating = useAuthStore((s) => s.isHydrating);
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isHydrating && !user) router.push(`/${locale}/login`);
  }, [user, isHydrating, locale, router]);

  if (isHydrating || !user) return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
    </div>
  );

  const isDoctor = user.role === 'DOCTOR';
  const patientNav = [
    { label: 'Overview', href: `/${locale}/dashboard`, icon: '🏠' },
    { label: 'My Bookings', href: `/${locale}/bookings`, icon: '📅' },
    { label: 'Prescriptions', href: `/${locale}/prescriptions`, icon: '💊' },
    { label: 'Find Doctors', href: `/${locale}/find-doctors`, icon: '🔍' },
  ];
  const doctorNav = [
    { label: 'Overview', href: `/${locale}/dashboard`, icon: '🏠' },
    { label: 'Appointments', href: `/${locale}/appointments`, icon: '📅' },
    { label: 'My Patients', href: `/${locale}/patients`, icon: '👥' },
    { label: 'Slots', href: `/${locale}/slots`, icon: '🕐' },
  ];
  const navItems = isDoctor ? doctorNav : patientNav;

  return (
    <div className="flex min-h-[calc(100vh-64px)]">
      {/* Sidebar */}
      <aside className="hidden w-56 flex-shrink-0 border-r border-gray-200 bg-white lg:block">
        <div className="p-4">
          <div className="mb-6 rounded-xl bg-sky-50 p-3">
            <p className="text-xs text-gray-500">Signed in as</p>
            <p className="truncate text-sm font-semibold text-gray-900">{user.name}</p>
            <span className="mt-1 inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
              {user.role}
            </span>
          </div>
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}
                className={clsx(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                  pathname === item.href ? 'bg-sky-500 text-white' : 'text-gray-600 hover:bg-gray-100',
                )}>
                <span>{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 bg-gray-50 p-6 lg:p-8">{children}</main>
    </div>
  );
}

'use client';
import type { JSX } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth-store';
import { apiClient } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';

interface Booking {
  id: string; startsAt: string; consultationType: string; status: string;
  doctor?: { firstName: string; lastName: string; specialisation: string; };
  patient?: { firstName: string; lastName: string; };
}
interface BookingsResponse { bookings: Booking[]; total: number; }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
}

const statusColor: Record<string, 'sky' | 'emerald' | 'amber' | 'red' | 'gray'> = {
  CONFIRMED: 'emerald', PENDING_PAYMENT: 'amber', COMPLETED: 'gray',
  CANCELLED_BY_PATIENT: 'red', CANCELLED_BY_DOCTOR: 'red',
};

export default function DashboardPage(): JSX.Element {
  const user = useAuthStore((s) => s.user);
  const locale = useLocale();
  const isDoctor = user?.role === 'DOCTOR';

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-bookings', user?.id],
    queryFn: () => apiClient.get<BookingsResponse>('/bookings?limit=5&page=1'),
    enabled: !!user,
  });

  const bookings = data?.data.bookings ?? [];
  const upcoming = bookings.filter((b) => ['CONFIRMED', 'PENDING_PAYMENT'].includes(b.status));

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="rounded-2xl bg-gradient-to-r from-sky-500 to-sky-400 p-6 text-white">
        <h1 className="text-2xl font-bold">Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}, {user?.name.split(' ')[0]}! 👋</h1>
        <p className="mt-1 text-sky-100">
          {upcoming.length > 0 ? `You have ${upcoming.length} upcoming appointment${upcoming.length > 1 ? 's' : ''}.` : 'No upcoming appointments.'}
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Upcoming', value: upcoming.length, icon: '📅', color: 'bg-sky-50 text-sky-600' },
          { label: 'Total Bookings', value: data?.data.total ?? 0, icon: '📋', color: 'bg-emerald-50 text-emerald-600' },
          { label: 'Role', value: user?.role ?? '', icon: '👤', color: 'bg-violet-50 text-violet-600' },
          { label: 'Status', value: 'Active', icon: '✅', color: 'bg-amber-50 text-amber-600' },
        ].map((stat) => (
          <div key={stat.label} className={`rounded-2xl ${stat.color} p-4 bg-white border border-gray-100 shadow-sm`}>
            <p className="text-2xl">{stat.icon}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-xs text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Recent bookings */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Recent Appointments</h2>
          <Link href={`/${locale}/${isDoctor ? 'appointments' : 'bookings'}`}
            className="text-sm text-sky-600 hover:underline">View all</Link>
        </div>

        {isLoading && <div className="mt-4 space-y-3">{Array.from({length: 3}).map((_,i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-100" />)}</div>}

        {!isLoading && bookings.length === 0 && (
          <div className="mt-4 rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
            <p className="text-gray-400">No appointments yet</p>
            {!isDoctor && (
              <Link href={`/${locale}/find-doctors`}
                className="mt-3 inline-block rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600">
                Find a doctor
              </Link>
            )}
          </div>
        )}

        {!isLoading && bookings.length > 0 && (
          <div className="mt-4 space-y-3">
            {bookings.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {isDoctor
                      ? `${b.patient?.firstName ?? ''} ${b.patient?.lastName ?? ''}`
                      : `Dr. ${b.doctor?.firstName ?? ''} ${b.doctor?.lastName ?? ''}`}
                  </p>
                  <p className="text-xs text-gray-500">{fmtDate(b.startsAt)} · {b.consultationType?.replace('_', ' ')}</p>
                </div>
                <Badge color={statusColor[b.status] ?? 'gray'}>{b.status.replace(/_/g, ' ')}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';
import type { JSX } from 'react';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Booking {
  id: string; startsAt: string; endsAt: string; status: string;
  consultationType: string; feePaise: number;
  doctor?: { firstName: string; lastName: string; specialisation: string; avatarUrl?: string; };
}
interface Res { bookings: Booking[]; total: number; }

const statusColor: Record<string, 'sky' | 'emerald' | 'amber' | 'red' | 'gray'> = {
  CONFIRMED: 'emerald', PENDING_PAYMENT: 'amber', COMPLETED: 'sky',
  CANCELLED_BY_PATIENT: 'red', CANCELLED_BY_DOCTOR: 'red', CANCELLED_BY_SYSTEM: 'red',
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function BookingsPage(): JSX.Element {
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['bookings', tab],
    queryFn: () => apiClient.get<Res>(`/bookings?limit=20&page=1&status=${tab === 'upcoming' ? 'CONFIRMED,PENDING_PAYMENT' : 'COMPLETED,CANCELLED_BY_PATIENT,CANCELLED_BY_DOCTOR'}`),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/bookings/${id}/cancel`, { reason: 'Cancelled by patient' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookings'] }),
    onError: (e: unknown) => alert(e instanceof Error ? e.message : 'Cancel failed'),
  });

  const bookings = data?.data.bookings ?? [];

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">My Bookings</h1>

      {/* Tabs */}
      <div className="flex rounded-xl border border-gray-200 bg-white p-1 w-fit">
        {(['upcoming', 'past'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-lg px-5 py-2 text-sm font-medium transition capitalize ${tab === t ? 'bg-sky-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {isLoading && <div className="space-y-3">{Array.from({length: 4}).map((_,i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-gray-100" />)}</div>}

      {!isLoading && bookings.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
          <p className="text-gray-400">No {tab} bookings</p>
        </div>
      )}

      {!isLoading && bookings.map((b) => (
        <div key={b.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-sky-100 text-lg font-bold text-sky-600">
                {b.doctor?.firstName?.[0] ?? 'D'}
              </div>
              <div>
                <p className="font-semibold text-gray-900">
                  Dr. {b.doctor?.firstName} {b.doctor?.lastName}
                </p>
                <p className="text-sm text-sky-600">{b.doctor?.specialisation}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {fmt(b.startsAt)} · {b.consultationType?.replace('_', ' ')} · ₹{Math.round(b.feePaise / 100)}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge color={statusColor[b.status] ?? 'gray'}>{b.status.replace(/_/g, ' ')}</Badge>
              {b.status === 'CONFIRMED' && (
                <Button variant="danger" size="sm"
                  loading={cancelMutation.isPending}
                  onClick={() => { if (confirm('Cancel this booking?')) cancelMutation.mutate(b.id); }}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

'use client';
import type { JSX } from 'react';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import Image from 'next/image';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';

interface Slot { id: string; startsAt: string; endsAt: string; consultationType: string; durationMinutes: number; feePaise: number; }
interface DoctorProfile {
  id: string; firstName: string; lastName: string; specialisation: string;
  qualifications: string[]; experienceYears: number; bio?: string;
  consultationFee: number; avatarUrl?: string; clinicName?: string;
  clinicCity?: string; rating?: number; reviewCount?: number;
  consultationTypes: string[];
}
interface BookingResponse { id: string; razorpayOrderId?: string; }

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function DoctorProfilePage(): JSX.Element {
  const params = useParams<{ id: string; locale: string }>();
  const locale = useLocale();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [bookingDone, setBookingDone] = useState<string | null>(null);

  const { data: docData, isLoading: docLoading } = useQuery({
    queryKey: ['doctor', params.id],
    queryFn: () => apiClient.get<DoctorProfile>(`/doctors/${params.id}`),
  });

  const { data: slotsData } = useQuery({
    queryKey: ['slots', params.id],
    queryFn: () => {
      const from = new Date().toISOString();
      const to = new Date(Date.now() + 7 * 86400_000).toISOString();
      return apiClient.get<{ slots: Slot[] }>(`/slots?doctorId=${params.id}&from=${from}&to=${to}&available=true`);
    },
    enabled: !!params.id,
  });

  const bookMutation = useMutation({
    mutationFn: (slotId: string) =>
      apiClient.post<BookingResponse>('/bookings', { slotId, consultationType: selectedSlot?.consultationType }),
    onSuccess: (res) => setBookingDone(res.data.id),
    onError: (e: unknown) => alert(e instanceof Error ? e.message : 'Booking failed'),
  });

  const doctor = docData?.data;
  const slots = slotsData?.data.slots ?? [];

  if (docLoading) return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
    </div>
  );
  if (!doctor) return <div className="py-20 text-center text-gray-500">Doctor not found.</div>;

  if (bookingDone) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
        <svg className="h-8 w-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-gray-900">Booking Confirmed!</h2>
      <p className="text-gray-500">Booking ID: <span className="font-mono text-sm">{bookingDone}</span></p>
      <Button onClick={() => router.push(`/${locale}/dashboard`)}>Go to dashboard</Button>
    </div>
  );

  const feeRupees = Math.round(doctor.consultationFee / 100);

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left: Profile */}
          <div className="lg:col-span-2 space-y-5">
            {/* Doctor card */}
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
              <div className="flex gap-5">
                <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-full bg-sky-100">
                  {doctor.avatarUrl ? (
                    <Image src={doctor.avatarUrl} alt={doctor.firstName} fill className="object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-3xl font-bold text-sky-600">
                      {doctor.firstName[0]}
                    </span>
                  )}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Dr. {doctor.firstName} {doctor.lastName}</h1>
                  <p className="text-sky-600 font-medium">{doctor.specialisation}</p>
                  <p className="mt-1 text-sm text-gray-500">{doctor.experienceYears} years experience</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {doctor.qualifications?.map((q) => <Badge key={q} color="gray">{q}</Badge>)}
                  </div>
                </div>
              </div>
              {doctor.bio && <p className="mt-4 text-sm text-gray-600">{doctor.bio}</p>}
              {doctor.clinicName && (
                <p className="mt-3 text-sm text-gray-500">🏥 {doctor.clinicName}{doctor.clinicCity ? `, ${doctor.clinicCity}` : ''}</p>
              )}
              {doctor.rating && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-yellow-400">★★★★★</span>
                  <span className="text-sm font-medium">{doctor.rating.toFixed(1)}</span>
                  <span className="text-xs text-gray-400">({doctor.reviewCount} reviews)</span>
                </div>
              )}
            </div>

            {/* Consultation types */}
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
              <h2 className="font-semibold text-gray-900">Consultation Options</h2>
              <div className="mt-3 flex flex-wrap gap-3">
                {doctor.consultationTypes.map((type) => (
                  <div key={type} className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5">
                    <span>{type === 'VIDEO' ? '📹' : type === 'HOME_VISIT' ? '🏠' : '🏥'}</span>
                    <div>
                      <p className="text-sm font-medium">{type === 'IN_CLINIC' ? 'In Clinic' : type === 'VIDEO' ? 'Video Call' : 'Home Visit'}</p>
                      <p className="text-xs text-gray-500">₹{feeRupees}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Slot booking */}
          <div className="space-y-4">
            <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Book Appointment</h2>
                <span className="text-lg font-bold text-sky-600">₹{feeRupees}</span>
              </div>

              <div className="mt-4 max-h-80 overflow-y-auto space-y-2 pr-1">
                {slots.length === 0 && <p className="py-4 text-center text-sm text-gray-400">No slots available</p>}
                {slots.map((slot) => (
                  <button
                    key={slot.id}
                    onClick={() => setSelectedSlot(slot)}
                    className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition ${selectedSlot?.id === slot.id ? 'border-sky-500 bg-sky-50' : 'border-gray-200 hover:border-sky-300'}`}
                  >
                    <p className="font-medium text-gray-900">{formatDate(slot.startsAt)}</p>
                    <p className="text-gray-500">{formatTime(slot.startsAt)} · {slot.durationMinutes} min</p>
                  </button>
                ))}
              </div>

              {selectedSlot && (
                <div className="mt-4">
                  {!user ? (
                    <Button className="w-full" onClick={() => router.push(`/${locale}/login`)}>
                      Login to book
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      loading={bookMutation.isPending}
                      onClick={() => bookMutation.mutate(selectedSlot.id)}
                    >
                      Confirm Booking · ₹{feeRupees}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

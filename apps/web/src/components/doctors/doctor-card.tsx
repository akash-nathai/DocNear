'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface DoctorCardData {
  id: string;
  firstName: string;
  lastName: string;
  specialisation: string;
  experienceYears: number;
  consultationFee: number; // paise
  rating?: number;
  reviewCount?: number;
  avatarUrl?: string;
  consultationTypes: string[];
  clinicCity?: string;
  isAvailableToday?: boolean;
  nextSlotAt?: string;
}

export function DoctorCard({ doctor }: { doctor: DoctorCardData }) {
  const t = useTranslations('DoctorCard');
  const locale = useLocale();
  const feeRupees = Math.round(doctor.consultationFee / 100);
  const name = `Dr. ${doctor.firstName} ${doctor.lastName}`;

  return (
    <div className="flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex gap-4">
        {/* Avatar */}
        <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-full bg-sky-100">
          {doctor.avatarUrl ? (
            <Image src={doctor.avatarUrl} alt={name} fill className="object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-2xl font-bold text-sky-600">
              {doctor.firstName[0]}
            </span>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-gray-900">{name}</h3>
          <p className="text-sm text-sky-600">{doctor.specialisation}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {t('experience', { years: doctor.experienceYears })}
            {doctor.clinicCity ? ` · ${doctor.clinicCity}` : ''}
          </p>
        </div>
      </div>

      {/* Tags */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {doctor.consultationTypes.map((type) => (
          <Badge key={type} color={type === 'VIDEO' ? 'violet' : type === 'HOME_VISIT' ? 'emerald' : 'sky'}>
            {type === 'VIDEO' ? 'Video' : type === 'HOME_VISIT' ? 'Home Visit' : 'Clinic'}
          </Badge>
        ))}
        {doctor.isAvailableToday && <Badge color="emerald">Available Today</Badge>}
      </div>

      {/* Rating + Fee */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          {doctor.rating && (
            <>
              <span className="text-yellow-400">★</span>
              <span className="text-sm font-medium text-gray-700">{doctor.rating.toFixed(1)}</span>
              {doctor.reviewCount !== undefined && (
                <span className="text-xs text-gray-400">({doctor.reviewCount})</span>
              )}
            </>
          )}
        </div>
        <span className="text-base font-bold text-gray-900">₹{feeRupees}</span>
      </div>

      {/* CTA */}
      <Link href={`/${locale}/doctors/${doctor.id}`} className="mt-4">
        <Button className="w-full" size="sm">{t('bookNow')}</Button>
      </Link>
    </div>
  );
}

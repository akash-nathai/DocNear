'use client';
import type { JSX } from 'react';
import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DoctorCard, type DoctorCardData } from '@/components/doctors/doctor-card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';

const SPECIALISATIONS = ['All', 'General Physician', 'Cardiologist', 'Dermatologist', 'Paediatrician', 'Gynaecologist', 'Orthopaedic', 'Psychiatrist', 'ENT'];
const CONSULTATION_TYPES = ['All', 'IN_CLINIC', 'VIDEO', 'HOME_VISIT'];

interface DoctorsResponse {
  doctors: DoctorCardData[];
  total: number;
  page: number;
  limit: number;
}

export default function FindDoctorsPage(): JSX.Element {
  const [search, setSearch] = useState('');
  const [spec, setSpec] = useState('All');
  const [ctype, setCtype] = useState('All');
  const [query, setQuery] = useState({ search: '', specialisation: '', consultationType: '' });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['doctors', query],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '12', page: '1' });
      if (query.search) params.set('q', query.search);
      if (query.specialisation) params.set('specialisation', query.specialisation);
      if (query.consultationType) params.set('consultationType', query.consultationType);
      return apiClient.get<DoctorsResponse>(`/doctors?${params}`);
    },
    staleTime: 30_000,
  });

  const handleSearch = useCallback(() => {
    setQuery({
      search,
      specialisation: spec === 'All' ? '' : spec,
      consultationType: ctype === 'All' ? '' : ctype,
    });
  }, [search, spec, ctype]);

  const doctors = data?.data.doctors ?? [];

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-gradient-to-br from-sky-600 to-sky-400 py-14 px-4 text-center text-white">
        <h1 className="text-3xl font-extrabold sm:text-4xl">Find Trusted Doctors Near You</h1>
        <p className="mt-2 text-sky-100">Book appointments instantly. No waiting, no queues.</p>

        {/* Search bar */}
        <div className="mx-auto mt-8 flex max-w-2xl gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search doctors, specialities, symptoms..."
            className="flex-1 rounded-xl border-0 bg-white/20 px-5 py-3.5 text-white placeholder:text-sky-200 focus:outline-none focus:ring-2 focus:ring-white/50 backdrop-blur"
          />
          <Button onClick={handleSearch} size="lg" className="bg-white text-sky-600 hover:bg-sky-50">
            Search
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-3">
          {/* Specialisation */}
          <div className="flex flex-wrap gap-2">
            {SPECIALISATIONS.map((s) => (
              <button key={s} onClick={() => setSpec(s)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${spec === s ? 'border-sky-500 bg-sky-500 text-white' : 'border-gray-300 bg-white text-gray-600 hover:border-sky-400'}`}>
                {s}
              </button>
            ))}
          </div>
          {/* Consultation type */}
          <div className="flex gap-2">
            {CONSULTATION_TYPES.map((c) => (
              <button key={c} onClick={() => setCtype(c)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${ctype === c ? 'border-sky-500 bg-sky-500 text-white' : 'border-gray-300 bg-white text-gray-600 hover:border-sky-400'}`}>
                {c === 'IN_CLINIC' ? 'Clinic' : c === 'HOME_VISIT' ? 'Home Visit' : c}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        {isLoading && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-64 animate-pulse rounded-2xl bg-gray-200" />
            ))}
          </div>
        )}

        {isError && (
          <div className="rounded-2xl border-2 border-dashed border-gray-300 p-12 text-center">
            <p className="text-gray-500">Could not load doctors. Is the API running?</p>
            <Button variant="outline" className="mt-4" onClick={handleSearch}>Retry</Button>
          </div>
        )}

        {!isLoading && !isError && doctors.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-gray-300 p-12 text-center">
            <p className="text-gray-500">No doctors found. Try a different search.</p>
          </div>
        )}

        {!isLoading && doctors.length > 0 && (
          <>
            <p className="mb-4 text-sm text-gray-500">{data?.data.total ?? doctors.length} doctors found</p>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {doctors.map((doc) => <DoctorCard key={doc.id} doctor={doc} />)}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

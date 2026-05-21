'use client';
import type { JSX } from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import type { AuthUser } from '@/lib/auth-store';

const schema = z.object({
  firstName: z.string().min(2, 'First name required'),
  lastName: z.string().min(1, 'Last name required'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Minimum 8 characters'),
  role: z.enum(['PATIENT', 'DOCTOR']),
});
type FormData = z.infer<typeof schema>;
interface RegisterResponse { accessToken: string; user: AuthUser }

export default function SignupPage(): JSX.Element {
  const locale = useLocale();
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [tab, setTab] = useState<'PATIENT' | 'DOCTOR'>('PATIENT');
  const [serverError, setServerError] = useState('');
  const [doctorPending, setDoctorPending] = useState(false);

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'PATIENT' },
  });

  function switchTab(role: 'PATIENT' | 'DOCTOR') {
    setTab(role);
    setValue('role', role);
    setServerError('');
  }

  async function onSubmit(data: FormData) {
    setServerError('');
    try {
      const res = await apiClient.post<RegisterResponse>('/auth/register', data);
      if (data.role === 'DOCTOR') { setDoctorPending(true); return; }
      setAuth(res.data.user, res.data.accessToken);
      router.push(`/${locale}/dashboard`);
    } catch (e: unknown) {
      setServerError(e instanceof Error ? e.message : 'Registration failed');
    }
  }

  if (doctorPending) {
    return (
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg border border-gray-100 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
          <svg className="h-7 w-7 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900">Application Under Review</h2>
        <p className="mt-2 text-sm text-gray-500">We&apos;ll verify your credentials and notify you within 2–3 business days.</p>
        <Link href={`/${locale}/find-doctors`}><Button variant="outline" className="mt-6 w-full">Back to home</Button></Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg border border-gray-100">
      <h1 className="text-2xl font-bold text-gray-900">Create account</h1>
      <div className="mt-4 flex rounded-xl border border-gray-200 p-1">
        {(['PATIENT', 'DOCTOR'] as const).map((role) => (
          <button key={role} type="button" onClick={() => switchTab(role)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${tab === role ? 'bg-sky-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {role === 'PATIENT' ? '👤 Patient' : '🩺 Doctor'}
          </button>
        ))}
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-5 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="First name" placeholder="Rahul" error={errors.firstName?.message} {...register('firstName')} />
          <Input label="Last name" placeholder="Sharma" error={errors.lastName?.message} {...register('lastName')} />
        </div>
        <Input label="Email" type="email" placeholder="you@example.com" error={errors.email?.message} {...register('email')} />
        <Input label="Password" type="password" placeholder="Min 8 characters" error={errors.password?.message} {...register('password')} />
        <input type="hidden" {...register('role')} />
        {tab === 'DOCTOR' && (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-700">
            ⚠️ Doctor accounts require admin approval within 2–3 business days.
          </p>
        )}
        {serverError && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{serverError}</div>}
        <Button type="submit" loading={isSubmitting} className="mt-1 w-full" size="lg">
          {tab === 'PATIENT' ? 'Create patient account' : 'Apply as doctor'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{' '}
        <Link href={`/${locale}/login`} className="font-medium text-sky-600 hover:underline">Sign in</Link>
      </p>
    </div>
  );
}

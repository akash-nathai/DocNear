import type { JSX } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { useTranslations } from 'next-intl';
import type { Metadata } from 'next';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'Auth' });
  return { title: t('signupPatient') };
}

export default function SignupPage({
  params: { locale },
}: {
  params: { locale: string };
}): JSX.Element {
  setRequestLocale(locale);

  const t = useTranslations('Auth');

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-gray-900">
          {t('signupPatient')}
        </h1>

        {/* Signup form — Phase 4 */}
        <div className="mt-8 rounded-xl border-2 border-dashed border-gray-300 p-8 text-center">
          <p className="text-gray-400">Sign-up form — Phase 4</p>
        </div>
      </div>
    </main>
  );
}

import type { JSX } from 'react';
import { useTranslations } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'Nav' });
  return { title: t('findDoctors') };
}

export default function FindDoctorsPage({
  params: { locale },
}: {
  params: { locale: string };
}): JSX.Element {
  setRequestLocale(locale);

  const t = useTranslations('Home');

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Hero */}
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            {t('hero')}
          </h1>
          <p className="mt-4 text-lg text-gray-600">{t('subhero')}</p>
        </div>

        {/* Search bar placeholder */}
        <div className="mt-10 flex justify-center">
          <div className="w-full max-w-2xl">
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              className="w-full rounded-xl border border-gray-300 bg-white px-5 py-4 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            />
          </div>
        </div>

        {/* CTA buttons */}
        <div className="mt-6 flex justify-center gap-4">
          <button className="rounded-lg bg-sky-500 px-6 py-3 text-sm font-medium text-white hover:bg-sky-600">
            {t('bookOnline')}
          </button>
          <button className="rounded-lg border border-sky-500 px-6 py-3 text-sm font-medium text-sky-600 hover:bg-sky-50">
            {t('bookClinic')}
          </button>
        </div>

        {/* Placeholder for doctor list — Phase 3+ */}
        <div className="mt-16 rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">
          <p className="text-gray-400">
            Doctor listing cards — Phase 3 (after DB migrations)
          </p>
        </div>
      </div>
    </main>
  );
}

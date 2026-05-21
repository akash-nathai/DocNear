import type { JSX } from 'react';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'Nav' });
  return { title: t('dashboard') };
}

export default function DashboardPage(): JSX.Element {
  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Dashboard — Phase 5+ */}
      <div className="mt-8 rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">
        <p className="text-gray-400">Dashboard — Phase 5 (after Auth)</p>
      </div>
    </main>
  );
}

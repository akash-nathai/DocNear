import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

// Root locale page redirects to /find-doctors
export default function LocaleIndexPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  redirect(`/${locale === 'en' ? '' : locale + '/'}find-doctors`);
}

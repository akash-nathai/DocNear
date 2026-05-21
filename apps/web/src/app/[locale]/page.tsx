import { redirect } from 'next/navigation';

// Root locale page redirects to /find-doctors
export default function LocaleIndexPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  redirect(`/${locale === 'en' ? '' : locale + '/'}find-doctors`);
}

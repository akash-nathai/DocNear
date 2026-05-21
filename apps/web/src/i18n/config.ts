import { notFound } from 'next/navigation';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  // Await the locale from the [locale] segment
  let locale = await requestLocale;

  // Fallback to default locale if not provided
  if (!locale) {
    locale = routing.defaultLocale;
  }

  // Validate locale
  if (!routing.locales.includes(locale as 'en' | 'hi' | 'bn')) {
    notFound();
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});

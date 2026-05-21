import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'hi', 'bn'],
  defaultLocale: 'en',
  // Default locale has no prefix: /find-doctors (not /en/find-doctors)
  localePrefix: 'as-needed',
});

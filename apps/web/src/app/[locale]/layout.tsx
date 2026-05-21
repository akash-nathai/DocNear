import type { JSX } from 'react';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { QueryProvider } from '@/providers/query-provider';
import { AuthProvider } from '@/providers/auth-provider';
import { Navbar } from '@/components/layout/navbar';
import '../globals.css';

const inter = Inter({ subsets: ['latin'] });

export async function generateStaticParams(): Promise<{ locale: string }[]> {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'Home' });

  return {
    title: {
      default: 'DocNear — Find Trusted Doctors Near You',
      template: '%s | DocNear',
    },
    description: t('subhero'),
    metadataBase: new URL(
      process.env.NEXT_PUBLIC_APP_URL ?? 'https://docnear.in',
    ),
  };
}

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}): Promise<JSX.Element> {
  if (!routing.locales.includes(locale as 'en' | 'hi' | 'bn')) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={inter.className}>
        <NextIntlClientProvider messages={messages}>
          <QueryProvider>
            <AuthProvider>
              <Navbar />
              <div className="min-h-screen">{children}</div>
            </AuthProvider>
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

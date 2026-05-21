import type { JSX } from 'react';
import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center bg-gradient-to-br from-sky-50 to-white px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-1">
        <span className="text-2xl font-extrabold text-sky-500">Doc</span>
        <span className="text-2xl font-extrabold text-gray-900">Near</span>
      </Link>
      {children}
    </div>
  );
}

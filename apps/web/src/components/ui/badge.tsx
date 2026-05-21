import { clsx } from 'clsx';

type Color = 'sky' | 'emerald' | 'amber' | 'red' | 'gray' | 'violet';

const colors: Record<Color, string> = {
  sky: 'bg-sky-100 text-sky-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
  gray: 'bg-gray-100 text-gray-600',
  violet: 'bg-violet-100 text-violet-700',
};

export function Badge({ children, color = 'sky', className }: { children: React.ReactNode; color?: Color; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', colors[color], className)}>
      {children}
    </span>
  );
}

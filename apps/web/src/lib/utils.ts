import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes without style conflicts.
 * shadcn/ui standard utility.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format Indian Rupee amounts from paise (integer) to display string.
 * e.g. formatRupees(50000) → "₹500"
 */
export function formatRupees(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(rupees);
}

/**
 * Format a distance in kilometres to a readable string.
 */
export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

/**
 * Sleep for a given number of milliseconds. Useful in retry loops.
 */
export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

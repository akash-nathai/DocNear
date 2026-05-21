import { QueryClient } from '@tanstack/react-query';
import { HttpError } from './api-client';

/**
 * Shared TanStack Query client configuration.
 *
 * Retry policy: don't retry on 4xx client errors (except 429 rate limit).
 * Stale time: 30 seconds — matches the slot availability cadence.
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) => {
          if (error instanceof HttpError) {
            // Never retry on auth errors
            if (error.status === 401 || error.status === 403) return false;
            // Don't retry other 4xx (except 429)
            if (error.status >= 400 && error.status < 500 && error.status !== 429)
              return false;
          }
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}

// Server-side singleton (one per request in RSC)
let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always a fresh client
    return makeQueryClient();
  }
  // Browser: reuse the client
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

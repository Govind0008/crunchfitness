import { QueryClient } from '@tanstack/react-query';

// Pages show what they loaded last time instantly, then refresh in the background (stale-while-
// revalidate, so a change saved a moment ago always shows up). Nothing is persisted to disk.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 0, gcTime: 30 * 60_000, refetchOnWindowFocus: false, retry: 1 },
  },
});

import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import type { Member } from '@/lib/admin/members';

/**
 * Page data that shows instantly on a return visit (from memory) and refreshes in the
 * background. `null` until the first load finishes; `error` is a plain message.
 */
export function useCached<T>(key: readonly unknown[], load: () => Promise<T>, enabled = true) {
  const q = useQuery({ queryKey: ['admin', ...key], queryFn: load, enabled });
  return { data: (q.data ?? null) as T | null, error: q.error ? (q.error as Error).message : null, refetch: () => { void q.refetch(); } };
}

/** A member already on screen in a cached list (Members, Dues…), so their profile can open instantly. */
export function cachedMember(id: string): Member | null {
  for (const [, data] of queryClient.getQueriesData<unknown>({ queryKey: ['admin'] })) {
    const list = Array.isArray(data) ? data : (data as { members?: unknown; rows?: unknown } | undefined)?.members ?? (data as { rows?: unknown } | undefined)?.rows;
    if (Array.isArray(list)) {
      const hit = list.find((x): x is Member => !!x && typeof x === 'object' && (x as Member).id === id && typeof (x as Member).phone === 'string');
      if (hit) return hit;
    }
  }
  return null;
}

import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getDocs, limit, query, startAfter, type DocumentData, type Query, type QueryDocumentSnapshot } from 'firebase/firestore';

export const PAGE_SIZES = [25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

/**
 * Cursor pagination for a Firestore list: one page is read at a time (`limit(size + 1)` — the
 * extra document only tells us whether a next page exists), and "Previous" walks back through the
 * cursors already seen. No count query, no whole-collection download.
 *
 * `key` names the query: when it changes (a new search, filter or sort) the list goes back to the
 * first page. `base` must already carry its `where`/`orderBy`; pass null to wait.
 */
export function usePaged<T>(key: string, base: Query<DocumentData> | null, map: (d: QueryDocumentSnapshot<DocumentData>) => T, initialSize: PageSize = 25) {
  const [size, setSizeState] = useState<PageSize>(initialSize);
  const [cursors, setCursors] = useState<QueryDocumentSnapshot<DocumentData>[]>([]);
  // Back to page 1 whenever the query or page size changes
  const [lastKey, setLastKey] = useState(`${key}|${size}`);
  if (lastKey !== `${key}|${size}`) { setLastKey(`${key}|${size}`); setCursors([]); }

  const cursor = cursors[cursors.length - 1];
  const q = useQuery({
    queryKey: ['admin', 'paged', key, size, cursor?.id ?? ''],
    enabled: !!base,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const snap = await getDocs(query(base!, ...(cursor ? [startAfter(cursor)] : []), limit(size + 1)));
      const docs = snap.docs.slice(0, size);
      return { rows: docs.map(map), last: docs[docs.length - 1] ?? null, hasNext: snap.docs.length > size };
    },
  });
  // Stay on a real page: if a page came back empty after deletions, step back
  const empty = q.data && !q.isPlaceholderData && q.data.rows.length === 0 && cursors.length > 0;
  useEffect(() => { if (empty) setCursors((c) => c.slice(0, -1)); }, [empty]);

  return {
    rows: q.data?.rows ?? null,
    error: q.error ? (q.error as Error).message : null,
    loading: q.isFetching,
    page: cursors.length + 1,
    size,
    hasPrev: cursors.length > 0,
    hasNext: !!q.data?.hasNext,
    next: () => { if (q.data?.hasNext && q.data.last) setCursors((c) => [...c, q.data!.last!]); },
    prev: () => setCursors((c) => c.slice(0, -1)),
    first: () => setCursors([]),
    setSize: (s: PageSize) => setSizeState(s),
    refetch: () => { void q.refetch(); },
  };
}
export type Paged<T> = ReturnType<typeof usePaged<T>>;

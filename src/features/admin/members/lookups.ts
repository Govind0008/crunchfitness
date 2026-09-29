import { useEffect, useState } from 'react';
import { collection, getDocs, orderBy, query, type Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface PlanRef { id: string; duration: string; price?: string }
export interface TrainerRef { id: string; name: string; role?: string }

type Lookups = { plans: Map<string, PlanRef>; trainers: Map<string, TrainerRef> };
const FRESH_MS = 30_000;
let cache: { at: number; p: Promise<Lookups> } | null = null;
let last: Lookups | null = null;   // the latest result, so a page can render names on its first paint

/** Shared across admin pages: moving between them doesn't re-read plans and trainers every time. */
function loadLookups(): Promise<Lookups> {
  if (cache && Date.now() - cache.at < FRESH_MS) return cache.p;
  const p = Promise.all([
    getDocs(query(collection(db, 'plans'), orderBy('order', 'asc'))),
    getDocs(collection(db, 'teamMembers')),
  ]).then(([ps, ts]) => ({
    plans: new Map(ps.docs.map((d) => [d.id, { id: d.id, ...(d.data() as Omit<PlanRef, 'id'>) }])),
    trainers: new Map(ts.docs.map((d) => [d.id, { id: d.id, ...(d.data() as Omit<TrainerRef, 'id'>) }])),
  }));
  cache = { at: Date.now(), p };
  p.then((d) => { last = d; }).catch(() => {});
  p.catch(() => { if (cache?.p === p) cache = null; });
  return p;
}
/** Call after plans or team profiles change, so the next page shows the new names and prices. */
export const invalidateLookups = () => { cache = null; };

/** Plans and trainers are small collections: load once, look names up by id (never copied onto members). */
export function useLookups() {
  const [data, setData] = useState<Lookups>(() => last ?? { plans: new Map(), trainers: new Map() });
  useEffect(() => {
    let off = false;
    loadLookups().then((d) => { if (!off) setData(d); }).catch(() => {});
    return () => { off = true; };
  }, []);
  return data;
}

export function fmtDate(v: string | Timestamp | null | undefined) {
  if (!v) return '';
  const d = typeof v === 'string' ? new Date(`${v}T00:00:00`) : v.toDate();
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
export const fmtTime = (t?: Timestamp) => (t ? t.toDate().toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '');

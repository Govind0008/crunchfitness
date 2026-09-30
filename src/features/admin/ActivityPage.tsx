import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ActivityEntry } from '@/lib/admin/activity';
import { AdminShell, Empty } from '@/features/events/admin/shared';
import { usePaged } from './usePaged';
import { DataRegion, ErrorNote, HeadRow, Pagination, SkeletonRows } from './kit';

const REF_LINK: Record<string, (id: string) => string> = { member: (id) => `/admin/members/${id}`, event: (id) => `/admin/events/${id}`, trainer: (id) => `/admin/trainers/${id}` };
const detail = (a: ActivityEntry) => Object.entries(a.meta ?? {}).filter(([, v]) => v !== null && v !== '').map(([k, v]) => (k === 'name' || k === 'title' ? v : `${k}: ${v}`)).join(' · ');

/** Activity — what staff changed, who, when. Append-only: nothing here can be edited. */
const ActivityPage = () => {
  const base = useMemo(() => query(collection(db, 'activity'), orderBy('at', 'desc')), []);
  const p = usePaged('activity', base, (d) => ({ id: d.id, ...d.data() }) as ActivityEntry, 50);
  const items = p.error ? [] : p.rows;
  return (
    <AdminShell title="Activity" nav="activity" area="System" fill
      subtitle="Changes to members, payments, plans, offers, blog posts, trainers and access. Append-only.">
      {p.error && <div className="mb-6"><ErrorNote what="Couldn’t load the activity log." error={p.error} onRetry={p.refetch} /></div>}
      {!items ? <SkeletonRows rows={8} /> : items.length === 0 ? <Empty title="Nothing logged yet" body="Admin changes will be listed here as they happen." /> : (
        <DataRegion>
        <HeadRow className="md:grid-cols-[11rem_1fr_auto]"><span>When</span><span>What</span><span>Who</span></HeadRow>
        <ol className="divide-y divide-white/[0.06]" aria-label="Activity log">
          {items.map((a) => {
            const href = a.refId && REF_LINK[a.refType]?.(a.refId);
            return (
              <li key={a.id} className="grid gap-1 px-4 py-2.5 text-sm md:grid-cols-[11rem_1fr_auto] md:items-baseline md:gap-x-3">
                <time className="text-sm tabular-nums text-ink-400" dateTime={a.at?.toDate().toISOString()}>{a.at ? a.at.toDate().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Just now'}</time>
                <p className="text-white">{href ? <Link to={href} className="hover:text-brand-fg">{a.action}</Link> : a.action}{detail(a) && <span className="text-ink-400"> — {detail(a)}</span>}</p>
                <p className="text-xs text-ink-500">{a.actorEmail}</p>
              </li>
            );
          })}
        </ol>
        </DataRegion>
      )}
      <Pagination p={p} label="Activity log" count={items?.length} />
    </AdminShell>
  );
};

export default ActivityPage;

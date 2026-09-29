import { useCached } from '@/features/admin/useCached';
import { Link } from 'react-router-dom';
import { recentActivity, type ActivityEntry } from '@/lib/admin/activity';
import { AdminShell, Empty } from '@/features/events/admin/shared';

const REF_LINK: Record<string, (id: string) => string> = { member: (id) => `/admin/members/${id}`, event: (id) => `/admin/events/${id}` };
const detail = (a: ActivityEntry) => Object.entries(a.meta ?? {}).filter(([, v]) => v !== null && v !== '').map(([k, v]) => (k === 'name' || k === 'title' ? v : `${k}: ${v}`)).join(' · ');

/** Activity — what staff changed, who, when. Append-only: nothing here can be edited. */
const ActivityPage = () => {
  const { data, error } = useCached(['activity'], () => recentActivity(200));
  const items: ActivityEntry[] | null = error ? [] : data;
  return (
    <AdminShell title="Activity" nav="activity" area="System">
      <p className="-mt-4 mb-6 text-sm text-ink-400">Changes to members, plans, offers, blog posts and trainer accounts. Each event keeps its own detailed log on its Activity tab.</p>
      {error && <p role="alert" className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
      {!items ? <div className="h-40 animate-pulse rounded-2xl bg-ink-900" /> : items.length === 0 ? <Empty title="Nothing logged yet" body="Admin changes will be listed here as they happen." /> : (
        <ol className="divide-y divide-white/[0.08] rounded-2xl border border-white/[0.08]" aria-label="Activity log">
          {items.map((a) => {
            const href = a.refId && REF_LINK[a.refType]?.(a.refId);
            return (
              <li key={a.id} className="grid gap-1 p-4 sm:grid-cols-[11rem_1fr_auto] sm:items-baseline sm:gap-6">
                <time className="text-sm tabular-nums text-ink-400" dateTime={a.at?.toDate().toISOString()}>{a.at ? a.at.toDate().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Just now'}</time>
                <p className="text-white">{href ? <Link to={href} className="hover:text-brand-400">{a.action}</Link> : a.action}{detail(a) && <span className="text-ink-400"> — {detail(a)}</span>}</p>
                <p className="text-xs text-ink-500">{a.actorEmail}</p>
              </li>
            );
          })}
        </ol>
      )}
    </AdminShell>
  );
};

export default ActivityPage;

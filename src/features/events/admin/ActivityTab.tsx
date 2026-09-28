import { useEffect, useState } from 'react';
import { watchActivity, type Activity, type CrunchEvent } from '@/lib/events';
import { Empty } from './shared';

const detail = (a: Activity) => {
  const m = a.meta ?? {};
  return [m.name, m.number, m.category, m.score, m.title, m.file].filter(Boolean).join(' · ');
};

/** What happened, who did it, when. Read-only — the rules make the log append-only. */
const ActivityTab = ({ ev }: { ev: CrunchEvent }) => {
  const [items, setItems] = useState<Activity[] | null>(null);
  useEffect(() => watchActivity(ev.id, setItems), [ev.id]);
  if (!items) return <div className="h-32 animate-pulse rounded-2xl bg-ink-900" />;
  if (!items.length) return <Empty title="Nothing yet" body="Every change to this event will be listed here." />;
  return (
    <ol className="divide-y divide-white/[0.08] rounded-2xl border border-white/[0.08]" aria-label="Activity log">
      {items.map((a) => (
        <li key={a.id} className="grid gap-1 p-4 sm:grid-cols-[11rem_1fr_auto] sm:items-baseline sm:gap-6">
          <time className="text-sm tabular-nums text-ink-400" dateTime={a.at?.toDate().toISOString()}>
            {a.at ? a.at.toDate().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Just now'}
          </time>
          <p className="text-white">{a.action}{detail(a) && <span className="text-ink-400"> — {detail(a)}</span>}</p>
          <p className="text-xs text-ink-500">{a.actorEmail}</p>
        </li>
      ))}
    </ol>
  );
};

export default ActivityTab;

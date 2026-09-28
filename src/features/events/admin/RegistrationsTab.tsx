import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { passNumber, setRegistrationStatus, type CrunchEvent, type Registration, type RegistrationStatus } from '@/lib/events';
import { Empty, inputCls } from './shared';
import { useActor } from './actor';
import { REG_PILL, REG_LABEL, matchReg } from './registrations';

export const RegPill = ({ status }: { status: RegistrationStatus }) => (
  <span className={cn('inline-block rounded-full px-2.5 py-1 text-xs font-bold', REG_PILL[status])}>{REG_LABEL[status]}</span>
);

const RegistrationsTab = ({ ev, registrations }: { ev: CrunchEvent; registrations: Registration[] }) => {
  const actor = useActor();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [status, setStatusFilter] = useState<'all' | RegistrationStatus>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const catName = (id: string) => ev.categories.find((c) => c.id === id)?.name ?? '—';

  const rows = useMemo(
    () => registrations.filter((r) => matchReg(r, q) && (cat === 'all' || r.categoryId === cat) && (status === 'all' || r.status === status)),
    [registrations, q, cat, status],
  );
  const act = async (r: Registration, to: RegistrationStatus) => {
    setBusy(r.id);
    try { await setRegistrationStatus(ev, r, to, actor); } finally { setBusy(null); }
  };

  if (!registrations.length) return <Empty title="No registrations yet" body={ev.status === 'draft' ? 'Open registration to let people sign up on the website.' : 'Sign-ups from the website will appear here as they come in.'} />;

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <label className="relative">
          <span className="sr-only">Search by name, number or phone</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" aria-hidden />
          <input className={cn(inputCls, 'pl-11')} placeholder="Search name, CR-number or phone" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <label><span className="sr-only">Category</span>
          <select className={inputCls} value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="all">All categories</option>
            {ev.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label><span className="sr-only">Status</span>
          <select className={inputCls} value={status} onChange={(e) => setStatusFilter(e.target.value as typeof status)}>
            <option value="all">Everyone</option>
            <option value="registered">Not checked in</option>
            <option value="checked_in">Checked in</option>
            <option value="no_show">No-show</option>
          </select>
        </label>
      </div>
      <p className="mt-4 text-sm text-ink-400">{rows.length} of {registrations.length} shown</p>

      <ul className="mt-3 divide-y divide-white/[0.08] rounded-2xl border border-white/[0.08]">
        {rows.map((r) => (
          <li key={r.id} className="p-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              <span className="w-20 font-mono text-sm text-ink-400">{passNumber(r.number)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-white">{r.name}</span>
                <span className="text-sm text-ink-400">{catName(r.categoryId)}</span>
              </span>
              <RegPill status={r.status} />
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" size="sm" aria-expanded={open === r.id} onClick={() => setOpen(open === r.id ? null : r.id)}>View</Button>
                {r.status !== 'checked_in' && <Button size="sm" disabled={busy === r.id} onClick={() => act(r, 'checked_in')}>Check in</Button>}
                {r.status === 'registered' && <Button size="sm" variant="secondary" disabled={busy === r.id} onClick={() => act(r, 'no_show')}>Mark no-show</Button>}
                {r.status !== 'registered' && <Button size="sm" variant="secondary" disabled={busy === r.id} onClick={() => act(r, 'registered')}>Undo</Button>}
              </div>
            </div>
            {open === r.id && (
              <dl className="mt-4 grid gap-3 rounded-xl bg-ink-900 p-4 text-sm sm:grid-cols-3">
                <div><dt className="text-ink-500">Phone</dt><dd><a className="text-white underline-offset-4 hover:underline" href={`tel:${r.phone}`}>{r.phone}</a></dd></div>
                <div><dt className="text-ink-500">Email</dt><dd className="break-all text-white">{r.email || '—'}</dd></div>
                <div><dt className="text-ink-500">Name on public results</dt><dd className="text-white">{r.showName ? 'Yes' : `No — shown as “Athlete ${passNumber(r.number)}”`}</dd></div>
                {r.checkedInAt && <div className="sm:col-span-3"><dt className="text-ink-500">Checked in</dt><dd className="text-white">{r.checkedInAt.toDate().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} by {r.checkedInBy}</dd></div>}
              </dl>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default RegistrationsTab;

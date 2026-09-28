import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Upload, UserPlus } from 'lucide-react';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  STATE_LABEL, listMembers, memberCounts, memberState, searchMembers,
  type Member, type MemberCounts, type MemberFilter,
} from '@/lib/admin/members';
import { getSettings } from '@/lib/admin/settings';
import { formatPhone } from '@/lib/admin/phone';
import { AdminShell, Empty } from '@/features/events/admin/shared';
import { StatePill } from './shared';
import { useLookups, fmtDate } from './lookups';

const FILTERS: { id: MemberFilter; label: string; count: (c: MemberCounts) => number }[] = [
  { id: 'all', label: 'Total members', count: (c) => c.total },
  { id: 'active', label: 'Active', count: (c) => c.active },
  { id: 'expiring', label: 'Expiring soon', count: (c) => c.expiring },
  { id: 'inactive', label: 'Inactive', count: (c) => c.inactive },
];

/** Members — the gym's membership list. Counts are server-side; the list is paged. */
const MembersPage = () => {
  const [params, setParams] = useSearchParams();
  const filter = (FILTERS.find((f) => f.id === params.get('filter'))?.id ?? 'all') as MemberFilter;
  const [expDays, setExpDays] = useState<number | null>(null);
  const [counts, setCounts] = useState<MemberCounts | null>(null);
  const [rows, setRows] = useState<Member[] | null>(null);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | undefined>();
  const [more, setMore] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { plans, trainers } = useLookups();

  useEffect(() => { getSettings().then((s) => setExpDays(s.expiringSoonDays)); }, []);
  useEffect(() => { if (expDays != null) memberCounts(expDays).then(setCounts).catch((e) => setError(e.message)); }, [expDays]);
  const load = useCallback(async (reset: boolean) => {
    if (expDays == null) return;
    try {
      const page = await listMembers(filter, expDays, reset ? undefined : cursor);
      setRows((r) => (reset ? page.members : [...(r ?? []), ...page.members]));
      setCursor(page.last); setMore(page.more);
    } catch (e) { setError((e as Error).message); }
  }, [filter, expDays, cursor]);
  useEffect(() => { setRows(null); setCursor(undefined); }, [filter]);
  useEffect(() => { if (rows === null) load(true); }, [rows, load]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults(null); return; }
    const t = setTimeout(() => searchMembers(term).then(setResults).catch(() => setResults([])), 250);
    return () => clearTimeout(t);
  }, [q]);

  const list = results ?? rows;
  const planName = (id: string | null) => (id ? plans.get(id)?.duration ?? 'Unknown plan' : '—');
  const trainerName = (id: string | null) => (id ? trainers.get(id)?.name ?? '—' : '—');

  return (
    <AdminShell title="Members" nav="members" area="People"
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link to="/admin/members/import"><Upload /> Import</Link></Button>
          <Button asChild><Link to="/admin/members/new"><UserPlus /> Add member</Link></Button>
        </div>
      }>
      {error && <p role="alert" className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">Couldn’t load members: {error}</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" role="group" aria-label="Filter members">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" onClick={() => setParams(f.id === 'all' ? {} : { filter: f.id }, { replace: true })} aria-pressed={filter === f.id}
            className={cn('rounded-2xl border p-4 text-left transition-colors', filter === f.id ? 'border-brand-400/60 bg-brand-400/[0.06]' : 'border-white/[0.08] bg-ink-900 hover:border-white/20')}>
            <span className="block text-xs font-semibold uppercase tracking-wider text-ink-400">{f.label}</span>
            <span className="mt-1 block font-display text-4xl font-bold tabular-nums text-white">{counts ? f.count(counts) : '…'}</span>
            {f.id === 'expiring' && expDays != null && <span className="text-xs text-ink-500">next {expDays} days</span>}
          </button>
        ))}
      </div>
      {counts && counts.total > 0 && counts.withExpiry < counts.total && (
        <p className="mt-3 text-xs text-ink-500">{counts.total - counts.withExpiry} of {counts.total} members have no expiry date — they count as active until marked inactive or given an expiry.</p>
      )}

      <label className="relative mt-6 block max-w-xl">
        <span className="sr-only">Search members</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, phone, email or member ID"
          className="h-12 w-full rounded-xl border border-white/15 bg-ink-900 pl-11 pr-4 text-base text-white placeholder:text-ink-500 focus:border-brand-400 focus:outline-none" />
      </label>
      {results && <p className="mt-2 text-sm text-ink-400">{results.length} match{results.length === 1 ? '' : 'es'} for “{q.trim()}”</p>}

      <div className="mt-6">
        {list === null ? <div className="h-40 animate-pulse rounded-2xl bg-ink-900" aria-label="Loading members" /> :
          list.length === 0 ? (
            results ? <Empty title="No matches" body="Try part of the name, the last digits of the phone number, or the email." /> :
            counts?.total === 0 ? (
              <Empty title="No members yet" body="Add your first member, import your existing member list, or bring in the clients your trainers already manage.">
                <div className="flex flex-wrap justify-center gap-2">
                  <Button asChild><Link to="/admin/members/new"><UserPlus /> Add member</Link></Button>
                  <Button asChild variant="outline"><Link to="/admin/members/import"><Upload /> Import members</Link></Button>
                </div>
              </Empty>
            ) : <Empty title="No one here" body="No members match this filter." />
          ) : (
            <>
              {/* Table (md+) */}
              <div className="hidden overflow-x-auto rounded-2xl border border-white/[0.08] md:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-white/[0.08] text-xs uppercase tracking-wider text-ink-500">
                    <tr>{['Name', 'Phone', 'Membership', 'Status', 'Joined', 'Expiry', 'Trainer'].map((h) => <th key={h} scope="col" className="px-4 py-3 font-semibold">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {list.map((m) => (
                      <tr key={m.id} className="hover:bg-white/[0.02]">
                        <td className="px-4 py-3"><Link to={`/admin/members/${m.id}`} className="font-semibold text-white hover:text-brand-400">{m.name}</Link></td>
                        <td className="px-4 py-3 tabular-nums text-ink-300">{formatPhone(m.phone)}</td>
                        <td className="px-4 py-3 text-ink-300">{planName(m.planId)}</td>
                        <td className="px-4 py-3"><StatePill state={memberState(m, expDays ?? 14)} /></td>
                        <td className="px-4 py-3 text-ink-400">{fmtDate(m.membershipStart) || fmtDate(m.createdAt)}</td>
                        <td className="px-4 py-3 text-ink-400">{fmtDate(m.membershipEnd) || '—'}</td>
                        <td className="px-4 py-3 text-ink-400">{trainerName(m.trainerId)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Cards (mobile) */}
              <ul className="space-y-3 md:hidden">
                {list.map((m) => (
                  <li key={m.id}>
                    <Link to={`/admin/members/${m.id}`} className="block rounded-2xl border border-white/[0.08] bg-ink-900 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <span className="min-w-0"><span className="block truncate font-semibold text-white">{m.name}</span><span className="text-sm tabular-nums text-ink-400">{formatPhone(m.phone)}</span></span>
                        <StatePill state={memberState(m, expDays ?? 14)} />
                      </div>
                      <p className="mt-2 text-xs text-ink-500">{planName(m.planId)} · Expiry {fmtDate(m.membershipEnd) || '—'} · {trainerName(m.trainerId)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
              {!results && more && <Button variant="outline" className="mt-4" onClick={() => load(false)}>Load more</Button>}
            </>
          )}
      </div>
      <p className="mt-6 text-xs text-ink-500">States: {Object.values(STATE_LABEL).join(' · ')}. Last check-in is shown on each member’s profile.</p>
    </AdminShell>
  );
};

export default MembersPage;

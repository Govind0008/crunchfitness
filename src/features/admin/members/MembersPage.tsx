import { useEffect, useState } from 'react';
import { memberCountsQuery, memberExtrasQuery, settingsQuery } from '@/features/admin/pageData';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, SlidersHorizontal, Upload, UserPlus } from 'lucide-react';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  DUES_LOOKBACK_DAYS, STATE_LABEL, addDays, listMembers, memberCode, memberCounts, memberState, membersByIds, membersDue, searchMembers, todayIST,
  type Member, type MemberCounts, type MemberFilter,
} from '@/lib/admin/members';
import { accessEligibility } from '@/lib/access';
import { blockedMembers, identitiesByStatus } from '@/lib/access/store';
import { currentPt, membersWithCurrentPt, sessionsLeft } from '@/lib/admin/packages';
import AddMemberDrawer from './AddMemberDrawer';
import Avatar from './Avatar';
import { DataRegion, EmptyNote, ErrorNote, HeadRow, Pagination, SkeletonRows, StatusDot } from '@/features/admin/kit';
import { formatPhone } from '@/lib/admin/phone';
import { AdminShell } from '@/features/events/admin/shared';
import { StatePill } from './shared';
import { useLookups, fmtDate } from './lookups';

const FILTERS: { id: MemberFilter; label: string; count: (c: MemberCounts) => number }[] = [
  { id: 'all', label: 'All members', count: (c) => c.total },
  { id: 'active', label: 'Active', count: (c) => c.active },
  { id: 'expiring', label: 'Expiring soon', count: (c) => c.expiring },
  { id: 'inactive', label: 'Inactive', count: (c) => c.inactive },
];

/** Filters that start from other records (PT packages, device users, blocks, dues) — bounded, not paged. */
type SpecialFilter = 'pt' | 'access_enabled' | 'access_disabled' | 'bio_pending' | 'bio_synced' | 'dues';
const CHIPS: { id: MemberFilter | SpecialFilter; label: string }[] = [
  { id: 'expired', label: 'Expired' }, { id: 'no_membership', label: 'No membership' }, { id: 'pt', label: 'PT' },
  { id: 'access_enabled', label: 'Access enabled' }, { id: 'access_disabled', label: 'Access disabled' },
  { id: 'bio_pending', label: 'Biometric pending' }, { id: 'bio_synced', label: 'Biometric synced' }, { id: 'dues', label: 'Renewal due' },
];
const CHIP_GROUPS: { title: string; ids: string[] }[] = [
  { title: 'Membership', ids: ['expired', 'no_membership', 'dues'] },
  { title: 'PT', ids: ['pt'] },
  { title: 'Access', ids: ['access_enabled', 'access_disabled', 'bio_pending', 'bio_synced'] },
];
const SPECIAL = new Set<string>(['pt', 'access_enabled', 'access_disabled', 'bio_pending', 'bio_synced', 'dues']);

/** Members — the gym's membership list. Counts are server-side; the list is paged. */
const MembersPage = () => {
  const [params, setParams] = useSearchParams();
  // ?add=1 (from quick actions) opens the Add member drawer
  const [adding, setAdding] = useState(() => params.get('add') === '1');
  const setAddOpen = (o: boolean) => { setAdding(o); if (!o && params.has('add')) setParams((p) => { const n = new URLSearchParams(p); n.delete('add'); return n; }, { replace: true }); };
  const raw = params.get('filter') ?? 'all';
  const special = SPECIAL.has(raw) ? (raw as SpecialFilter) : null;
  const filter = (special ? 'all' : FILTERS.find((f) => f.id === raw)?.id ?? CHIPS.find((c) => c.id === raw && !SPECIAL.has(c.id))?.id ?? 'all') as MemberFilter;
  const active = special ?? filter;
  const [showFilters, setShowFilters] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Member[] | null>(null);
  const { plans } = useLookups();
  const qc = useQueryClient();

  // Everything below is cached per filter: coming back to Members (or a filter) is instant,
  // and it refreshes in the background.
  const expDays = useQuery(settingsQuery()).data?.expiringSoonDays ?? null;
  const countsQ = useQuery({ ...memberCountsQuery(expDays ?? 0), enabled: expDays != null });
  const counts: MemberCounts | null = countsQ.data ?? null;
  const [size, setSize] = useState<25 | 50 | 100>(50);
  const firstQ = useQuery({
    // The default page size keeps the key the dashboard prefetches
    queryKey: ['admin', 'members', active, expDays, ...(size === 50 ? [] : [size])],
    enabled: expDays != null,
    queryFn: async (): Promise<{ members: Member[]; last?: QueryDocumentSnapshot; more: boolean }> => {
      if (!special) return listMembers(filter, expDays!, undefined, size);
      const today = todayIST();
      const list = special === 'pt' ? await membersByIds(await membersWithCurrentPt(today))
        : special === 'access_disabled' ? await blockedMembers()
        : special === 'bio_pending' ? await membersByIds((await identitiesByStatus(['PENDING', 'SYNCING'])).map((i) => i.memberId))
        : special === 'bio_synced' ? await membersByIds((await identitiesByStatus(['SYNCED'])).map((i) => i.memberId))
        : special === 'dues' ? await membersDue(expDays!)
        : (await listMembers('active', expDays!)).members.filter((m) => accessEligibility(m, today).eligible === true);
      return { members: list, more: false };
    },
  });
  // Later pages, after the cached first page — cursor-based, one page on screen at a time.
  // A new filter or page size goes back to page 1.
  const [extraPages, setExtraPages] = useState<{ members: Member[]; last?: QueryDocumentSnapshot; more: boolean }[]>([]);
  const [pageIdx, setPageIdx] = useState(0);
  const [paging, setPaging] = useState(false);
  useEffect(() => { setExtraPages([]); setPageIdx(0); }, [active, expDays, size]);
  const current = pageIdx === 0 ? firstQ.data : extraPages[pageIdx - 1];
  const rows: Member[] | null = current ? current.members : null;
  const pager = {
    page: pageIdx + 1, size, loading: paging || firstQ.isFetching, hasPrev: pageIdx > 0, hasNext: !!current?.more,
    prev: () => setPageIdx((i) => Math.max(0, i - 1)),
    next: async () => {
      if (!current?.more || !current.last || expDays == null) return;
      if (!extraPages[pageIdx]) {
        setPaging(true);
        try { const page = await listMembers(filter, expDays, current.last, size); setExtraPages((x) => [...x.slice(0, pageIdx), page]); }
        finally { setPaging(false); }
      }
      setPageIdx((i) => i + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    setSize,
  };
  const error = (countsQ.error ?? firstQ.error) ? ((countsQ.error ?? firstQ.error) as Error).message : null;
  const reloadAll = () => { setExtraPages([]); setPageIdx(0); qc.invalidateQueries({ queryKey: ['admin', 'members'] }); qc.invalidateQueries({ queryKey: ['admin', 'memberCounts'] }); };

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults(null); return; }
    const t = setTimeout(() => searchMembers(term).then(setResults).catch(() => setResults([])), 250);
    return () => clearTimeout(t);
  }, [q]);

  const list = results ?? rows;
  // One round of batched lookups for the rows on screen: PT, device users, last check-in
  const ids = (list ?? []).map((m) => m.id).join(',');
  const extraQ = useQuery({ ...memberExtrasQuery(list ?? []), enabled: !!list?.length });
  const extra = list?.length ? extraQ.data ?? null : null;
  const today = todayIST();
  const ptOf = (m: Member) => (extra ? currentPt(extra.pt.get(m.id) ?? [], today) : undefined);
  const bioOf = (m: Member) => extra?.ids.get(m.id)?.find((i) => i.status !== 'REMOVED');
  const lastOf = (m: Member) => extra?.last.get(m.id);
  const dueOf = (m: Member) => m.status === 'active' && !!m.membershipEnd && m.membershipEnd <= addDays(today, expDays ?? 14) && m.membershipEnd >= addDays(today, -DUES_LOOKBACK_DAYS);
  const accessOf = (m: Member) => { const a = accessEligibility(m, today); return a.eligible ? 'Enabled' : a.eligible === false ? (m.accessOverride ? 'Blocked' : 'Disabled') : 'No membership'; };
  const planName = (id: string | null) => (id ? plans.get(id)?.duration ?? 'Unknown plan' : '—');

  const lastLabel = (m: Member) => {
    const t = lastOf(m); if (!t) return extra ? '—' : '…';
    const d = t.toDate(); const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
    return day === today ? `Today, ${d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}` : fmtDate(t);
  };
  const activeChip = CHIPS.find((c) => c.id === active);

  return (
    <AdminShell title="Members" nav="members" area="People" fill
      subtitle={counts ? `${counts.total} total · ${counts.active} active` : '…'}
      actions={<><Button asChild variant="ghost"><Link to="/admin/members/import"><Upload /> Import</Link></Button><Button onClick={() => setAdding(true)}><UserPlus /> Add member</Button></>}>
      {error && <div className="mb-6"><ErrorNote what="Couldn’t load members." error={error} onRetry={reloadAll} /></div>}

      <div className="flex flex-shrink-0 flex-col gap-2 lg:flex-row lg:items-center">
        <label className="relative block flex-1">
          <span className="sr-only">Search members</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, phone, email or member ID"
            className="h-10 w-full rounded-xl border border-white/15 bg-field pl-11 pr-4 text-sm text-white placeholder:text-ink-500 focus:border-brand-400 focus:outline-none" />
        </label>
        <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-white/[0.08] bg-ink-900 p-1" role="group" aria-label="Filter members">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" onClick={() => setParams(f.id === 'all' ? {} : { filter: f.id }, { replace: true })} aria-pressed={active === f.id}
              className={cn('whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors', active === f.id ? 'bg-white text-ink-950' : 'text-ink-300 hover:text-white')}>
              {f.label} <span className={cn('ml-1 tabular-nums', active === f.id ? 'text-ink-600' : 'text-ink-500')}>{counts ? f.count(counts) : '…'}</span>
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" className="h-10" aria-expanded={showFilters || !!activeChip} aria-controls="more-filters" onClick={() => setShowFilters(!showFilters)}>
          <SlidersHorizontal /> Filters{activeChip ? ` · ${activeChip.label}` : ''}
        </Button>
      </div>
      {(showFilters || activeChip) && (
        <div id="more-filters" className="mt-3 rounded-xl border border-white/[0.08] bg-ink-900 p-4" role="group" aria-label="More filters">
          {CHIP_GROUPS.map((g) => (
            <div key={g.title} className="flex flex-wrap items-center gap-2 py-1">
              <span className="w-24 text-xs font-semibold uppercase tracking-wider text-ink-500">{g.title}</span>
              {g.ids.map((id) => { const c = CHIPS.find((x) => x.id === id)!; return (
                <button key={c.id} type="button" aria-pressed={active === c.id} onClick={() => setParams(active === c.id ? {} : { filter: c.id }, { replace: true })}
                  className={cn('rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors', active === c.id ? 'border-white bg-white text-ink-950' : 'border-white/15 text-ink-300 hover:text-white')}>{c.label}</button>
              ); })}
            </div>
          ))}
        </div>
      )}
      {results && <p className="mt-3 text-sm text-ink-400">{results.length} match{results.length === 1 ? '' : 'es'} for “{q.trim()}”</p>}

      <div className="mt-3 flex flex-col lg:min-h-0 lg:flex-1">
        {list === null ? <SkeletonRows rows={6} /> :
          list.length === 0 ? (
            results ? <EmptyNote title="No matches" body="Try part of the name, the last digits of the phone number, or the member ID." /> :
            counts?.total === 0 ? (
              <EmptyNote title="No members yet" body="Add your first member, or import your existing member list.">
                <Button onClick={() => setAdding(true)}><UserPlus /> Add member</Button>
                <Button asChild variant="outline"><Link to="/admin/members/import"><Upload /> Import members</Link></Button>
              </EmptyNote>
            ) : <EmptyNote title="No one here" body="No members match this filter." />
          ) : (
            <>
              <DataRegion>
              <HeadRow className="md:grid-cols-[2.5rem_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_7rem]"><span /><span>Member</span><span>PT</span><span>Access</span><span>Last visit</span><span className="justify-self-end">Status</span></HeadRow>
              <ul className="divide-y divide-white/[0.06]" aria-label="Members">
                {list.map((m) => {
                  const st = memberState(m, expDays ?? 14);
                  const pt = ptOf(m); const bio = bioOf(m); const acc = accessOf(m);
                  return (
                    <li key={m.id}>
                      <Link to={`/admin/members/${m.id}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 px-4 py-2.5 transition-colors hover:bg-white/[0.03] focus-visible:bg-white/[0.04] md:grid-cols-[2.5rem_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_7rem]">
                        <Avatar m={m} size={36} />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-white">{m.name}</span>
                          <span className="block truncate text-xs text-ink-400"><span className="font-mono">{memberCode(m.id)}</span> · {st === 'inactive' && !m.membershipEnd ? 'No membership' : m.membershipEnd ? `${m.membershipEnd >= today ? 'Active until' : 'Ended'} ${fmtDate(m.membershipEnd)}` : 'No expiry'} · {planName(m.planId)}</span>
                        </span>
                        <span className="md:order-last md:justify-self-end"><StatePill state={st} /></span>
                        <span className="col-span-3 hidden min-w-0 md:col-span-1 md:block">
                          <span className="sr-only">PT</span>
                          <span className="text-sm text-ink-200">{pt === undefined ? '…' : pt ? (sessionsLeft(pt) != null ? `${sessionsLeft(pt)} sessions left` : 'Active') : '—'}</span>
                        </span>
                        <span className="hidden min-w-0 md:block">
                          <span className="sr-only">Access</span>
                          <StatusDot tone={acc === 'Enabled' ? 'ok' : acc === 'No membership' ? 'muted' : 'bad'} className="text-sm font-normal">{acc}{bio ? ` · ${bio.status === 'SYNCED' ? 'synced' : bio.status === 'PENDING' ? 'pending' : bio.status === 'ENROLLED' ? 'enrolled' : bio.status.toLowerCase().replace('_', ' ')}` : ''}</StatusDot>
                        </span>
                        <span className="hidden min-w-0 md:block">
                          <span className="sr-only">Last visit</span>
                          <span className="text-sm text-ink-200">{lastLabel(m)}</span>
                        </span>
                        <span className="col-span-3 flex flex-wrap gap-x-4 gap-y-1 pl-[3.25rem] text-xs text-ink-400 md:hidden">
                          <span>Access: {acc.toLowerCase()}</span>{pt && <span>PT active</span>}{dueOf(m) && <span className="text-amber-200">Renewal due</span>}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              </DataRegion>
              {!results && !special && <Pagination p={pager} label="Members" count={list.length} />}
            </>
          )}
      </div>
      <p className="mt-2 flex-shrink-0 text-xs text-ink-500">States: {Object.values(STATE_LABEL).join(' · ')}. Last visit = the latest visit, by fingerprint or at the front desk. “Renewal due” is an estimate from the expiry date, not money owed.</p>
      <AddMemberDrawer open={adding} onOpenChange={setAddOpen} onAdded={reloadAll} />
    </AdminShell>
  );
};

export default MembersPage;

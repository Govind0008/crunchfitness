import { useMemo } from 'react';
import { duesQuery } from '@/features/admin/pageData';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { DUES_LOOKBACK_DAYS, todayIST, type Member } from '@/lib/admin/members';
import { formatPhone } from '@/lib/admin/phone';
import { parsePrice, rupees, toPaise } from '@/lib/admin/payments';
import { Button } from '@/components/ui/button';
import { AdminShell, Empty } from '@/features/events/admin/shared';
import { fmtDate, useLookups } from '@/features/admin/members/lookups';

const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86400000);

/** Dues — renewals from real expiry dates. Amounts are each plan's CURRENT price, labelled as such. */
const DuesPage = () => {
  const { plans } = useLookups();
  const dq = useQuery(duesQuery());
  const data = dq.data, error = dq.error ? (dq.error as Error).message : null;
  const rows: Member[] | null = data?.rows ?? null;
  const days = data?.days ?? 14;

  const today = todayIST();
  const overdue = useMemo(() => (rows ?? []).filter((m) => (m.membershipEnd ?? '') < today), [rows, today]);
  const soon = useMemo(() => (rows ?? []).filter((m) => (m.membershipEnd ?? '') >= today), [rows, today]);
  const due = (m: Member) => { const p = m.planId ? parsePrice(plans.get(m.planId)?.price) : null; return p != null ? toPaise(p) : null; };
  const total = (list: Member[]) => list.reduce((s, m) => s + (due(m) ?? 0), 0);

  const Section = ({ title, list, tone }: { title: string; list: Member[]; tone: 'over' | 'soon' }) => (
    <section aria-labelledby={`${tone}-h`} className="mt-8">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`${tone}-h`} className="text-xs font-bold uppercase tracking-wider text-ink-400">{title} · {list.length}</h2>
        {list.length > 0 && <p className="text-sm text-ink-400">Estimated renewals <span className="text-white">{rupees(total(list))}</span> · based on current plan prices</p>}
      </div>
      {list.length === 0 ? <p className="rounded-2xl border border-dashed border-white/15 p-6 text-sm text-ink-400">{tone === 'over' ? 'No overdue renewals.' : `No memberships expire in the next ${days} days.`}</p> : (
        <ul className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08]">
          {list.map((m) => {
            const d = daysBetween(today, m.membershipEnd!);
            const amt = due(m);
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                <span className="min-w-0 flex-1">
                  <Link to={`/admin/members/${m.id}`} className="block truncate font-semibold text-white hover:text-brand-400">{m.name}</Link>
                  <span className="text-sm tabular-nums text-ink-400">{formatPhone(m.phone)} · {m.planId ? plans.get(m.planId)?.duration ?? 'Unknown plan' : 'No plan'}</span>
                </span>
                <span className="text-right text-sm">
                  <span className={tone === 'over' ? 'block font-semibold text-red-300' : 'block font-semibold text-amber-200'}>{d < 0 ? `${-d} day${d === -1 ? '' : 's'} overdue` : d === 0 ? 'Expires today' : `In ${d} day${d === 1 ? '' : 's'}`}</span>
                  <span className="text-xs text-ink-500">Expiry {fmtDate(m.membershipEnd)}</span>
                </span>
                <span className="w-36 text-right">
                  <span className="block font-display text-xl font-bold tabular-nums text-white">{amt != null ? rupees(amt) : '—'}</span>
                  <span className="text-[11px] text-ink-500">{amt != null ? 'Estimated next renewal' : 'No plan price'}</span>
                </span>
                <Button asChild size="sm"><Link to={`/admin/payments/new?member=${m.id}`}>Record payment</Link></Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );

  return (
    <AdminShell title="Dues" nav="dues" area="Money">
      <p className="-mt-4 text-sm text-ink-400">Renewals due, from member expiry dates. Amounts are <strong className="text-white">estimates</strong> — the member’s plan at its current price, not money owed. Record what they actually pay. Members with no expiry date, and memberships that ended more than {DUES_LOOKBACK_DAYS} days ago, don’t appear here — find those under <Link to="/admin/members?filter=inactive" className="text-white underline-offset-4 hover:underline">Members → Inactive</Link>. Old balances from the imported member sheet are never shown as dues.</p>
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">Dues couldn’t load: {error}</p>}
      {!rows && !error ? <div className="mt-8 h-40 animate-pulse rounded-2xl bg-ink-900" role="status" aria-label="Loading dues" /> : rows && (
        rows.length === 0 ? <div className="mt-8"><Empty title="Nothing due" body={`No memberships have expired or expire in the next ${days} days.`} /></div> : <>
          <Section title="Overdue" list={overdue} tone="over" />
          <Section title={`Due in the next ${days} days`} list={soon} tone="soon" />
        </>
      )}
    </AdminShell>
  );
};

export default DuesPage;

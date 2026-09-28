import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { todayIST } from '@/lib/admin/members';
import { KIND_LABEL, METHOD_LABEL, groupTotals, monthEnd, monthLabel, monthStart, paymentsBetween, revenueBetween, rupees, shiftMonth, type Payment } from '@/lib/admin/payments';
import { AdminShell } from '@/features/events/admin/shared';

interface Totals { paise: number; payments: number }
const Card = ({ label, t, sub }: { label: string; t: Totals | null; sub?: string }) => (
  <div className="rounded-2xl border border-white/[0.08] bg-ink-900 p-5">
    <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">{label}</p>
    <p className="mt-2 font-display text-4xl font-bold leading-none tabular-nums text-white">{t ? rupees(t.paise) : '…'}</p>
    <p className="mt-2 text-xs text-ink-500">{t ? `${t.payments} receipt${t.payments === 1 ? '' : 's'}` : ''}{sub ? ` · ${sub}` : ''}</p>
  </div>
);

/** Revenue — money received (voided payments excluded), summed by the server from the ledger. */
const RevenuePage = () => {
  const today = todayIST();
  const [cards, setCards] = useState<Record<string, Totals> | null>(null);
  const [trend, setTrend] = useState<{ month: string; paise: number }[] | null>(null);
  const [thisMonth, setThisMonth] = useState<Payment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const m0 = monthStart(today), last = shiftMonth(today, -1);
    Promise.all([
      revenueBetween(today, today), revenueBetween(m0, today), revenueBetween(last, monthEnd(last)), revenueBetween(`${today.slice(0, 4)}-01-01`, today),
    ]).then(([d, m, l, y]) => setCards({ today: d, month: m, last: l, year: y })).catch((e) => setError(e.message));
    const months = Array.from({ length: 12 }, (_, i) => shiftMonth(today, i - 11));
    Promise.all(months.map((s) => revenueBetween(s, monthEnd(s)).then((r) => ({ month: s, paise: r.paise }))))
      .then(setTrend).catch((e) => setError(e.message));
    paymentsBetween(m0, today).then(setThisMonth).catch((e) => setError(e.message));
  }, [today]);

  const max = Math.max(1, ...(trend ?? []).map((t) => t.paise));
  const byMethod = thisMonth ? groupTotals(thisMonth, (p) => METHOD_LABEL[p.method]) : [];
  const byPlan = thisMonth ? groupTotals(thisMonth, (p) => p.planName || 'No plan') : [];
  const byKind = thisMonth ? groupTotals(thisMonth, (p) => (p.kind ? KIND_LABEL[p.kind] : 'Not recorded (older payments)')) : [];
  const monthPaise = thisMonth?.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amountPaise, 0) ?? 0;

  return (
    <AdminShell title="Revenue" nav="revenue" area="Money">
      <p className="-mt-4 mb-6 text-sm text-ink-400">Money received, recorded in <Link to="/admin/payments" className="text-white underline-offset-4 hover:underline">Payments</Link>. Voided payments aren’t counted. Dates are payment dates (Pune time).</p>
      {error && (() => {
        // Firestore needs a one-time index for the revenue totals; show the fix, not a raw error
        const link = error.match(/https:\/\/console\.firebase\.google\.com\S+/)?.[0];
        return link ? (
          <div role="alert" className="mb-6 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
            <p className="font-semibold text-white">One-time setup needed</p>
            <p className="mt-1">Revenue totals need a database index in Firebase. <a href={link} target="_blank" rel="noopener noreferrer" className="font-semibold underline">Open Firebase and click “Create index”</a>, wait until it shows “Enabled” (a few minutes), then reload this page.</p>
          </div>
        ) : <p role="alert" className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">Revenue couldn’t load: {error}</p>;
      })()}
      <section aria-label="Revenue totals" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card label="Today" t={cards?.today ?? null} />
        <Card label="This month" t={cards?.month ?? null} sub="so far" />
        <Card label="Last month" t={cards?.last ?? null} />
        <Card label="This year" t={cards?.year ?? null} sub={`since 1 Jan ${today.slice(0, 4)}`} />
      </section>

      <section aria-labelledby="trend-h" className="mt-8 rounded-2xl border border-white/[0.08] bg-ink-900 p-5">
        <h2 id="trend-h" className="text-sm font-bold uppercase tracking-wider text-white">Last 12 months</h2>
        {!trend ? <div className="mt-4 h-40 animate-pulse rounded-xl bg-ink-800" role="status" aria-label="Updating report" /> : (
          <ol className="mt-5 flex h-44 items-end gap-2" aria-label="Revenue by month">
            {trend.map((t) => (
              <li key={t.month} className="flex h-full flex-1 flex-col items-center justify-end gap-2" title={`${monthLabel(t.month)}: ${rupees(t.paise)}`}>
                <span className="text-[10px] tabular-nums text-ink-400">{t.paise ? rupees(t.paise).replace('₹', '') : ''}</span>
                <span className="w-full rounded-t bg-brand-400/80" style={{ height: `${(t.paise / max) * 100}%`, minHeight: t.paise ? 3 : 0 }} />
                <span className="text-[10px] text-ink-500">{monthLabel(t.month)}</span>
                <span className="sr-only">{monthLabel(t.month)}: {rupees(t.paise)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {[['This month by method', byMethod], ['This month by plan', byPlan], ['New vs renewal', byKind]].map(([title, rows]) => (
          <section key={title as string} aria-label={title as string} className="rounded-2xl border border-white/[0.08] bg-ink-900 p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">{title as string}</h2>
            {!thisMonth ? <div className="mt-4 h-24 animate-pulse rounded-xl bg-ink-800" /> : (rows as ReturnType<typeof groupTotals>).length === 0 ? <p className="mt-4 text-sm text-ink-400">No payments this month yet.</p> : (
              <ul className="mt-4 space-y-3">
                {(rows as ReturnType<typeof groupTotals>).map(([k, v]) => (
                  <li key={k}>
                    <div className="flex justify-between text-sm"><span className="text-white">{k}</span><span className="tabular-nums text-ink-300">{rupees(v.paise)} · {v.count}</span></div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-brand-400" style={{ width: `${(v.paise / Math.max(1, monthPaise)) * 100}%` }} /></div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </AdminShell>
  );
};

export default RevenuePage;

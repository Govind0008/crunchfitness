import { useMemo, useState } from 'react';
import { paymentsQuery } from '@/features/admin/pageData';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { todayIST, addDays } from '@/lib/admin/members';
import { LIST_LIMIT, METHOD_LABEL, paymentFor, TYPE_LABEL, monthEnd, monthStart, paymentTypeOf, receiptLabel, rupees, shiftMonth, type Payment, type PaymentMethod, type PaymentType } from '@/lib/admin/payments';
import { AdminShell, Empty, inputCls } from '@/features/events/admin/shared';
import { fmtDate } from '@/features/admin/members/lookups';
import { PaymentStatus } from './ui';

type Preset = 'month' | 'last_month' | '7d' | 'custom';
function rangeOf(preset: Preset, from?: string | null, to?: string | null) {
  const t = todayIST();
  if (preset === 'last_month') { const s = shiftMonth(t, -1); return { from: s, to: monthEnd(s) }; }
  if (preset === '7d') return { from: addDays(t, -6), to: t };
  if (preset === 'custom' && from && to) return { from, to };
  return { from: monthStart(t), to: t };
}

/** Payments — the ledger. Filters live in the URL, so Back/Forward and shared links keep them. */
const PaymentsPage = () => {
  const [params, setParams] = useSearchParams();
  const preset = (params.get('range') as Preset) || 'month';
  const { from, to } = rangeOf(preset, params.get('from'), params.get('to'));
  const method = (params.get('method') as PaymentMethod | 'all') || 'all';
  const status = (params.get('status') as 'paid' | 'void' | 'all') || 'all';
  const type = (params.get('type') as PaymentType | 'all') || 'all';
  const [q, setQ] = useState('');

  const setParam = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v == null || v === '' ? next.delete(k) : next.set(k, v)));
    setParams(next);
  };

  const pq = useQuery(paymentsQuery(from, to));
  const rows = pq.data ?? null, error = pq.error ? (pq.error as Error).message : null;

  const shown = useMemo(() => (rows ?? []).filter((p) =>
    (method === 'all' || p.method === method) && (status === 'all' || p.status === status) && (type === 'all' || paymentTypeOf(p) === type) &&
    (!q.trim() || p.memberName.toLowerCase().includes(q.trim().toLowerCase()) || (p.receiptNo ?? '').toLowerCase().includes(q.trim().toLowerCase()))), [rows, method, status, type, q]);
  const total = shown.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amountPaise, 0);

  return (
    <AdminShell title="Payments" nav="payments" area="Money"
      actions={<Button asChild><Link to="/admin/payments/new"><Plus /> Record payment</Link></Button>}>
      <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Payment filters">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Date range">
          {([['month', 'This month'], ['last_month', 'Last month'], ['7d', 'Last 7 days'], ['custom', 'Custom']] as const).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={preset === id} onClick={() => setParam({ range: id === 'month' ? null : id, ...(id === 'custom' ? { from, to } : { from: null, to: null }) })}
              className={cn('rounded-full border px-4 py-2 text-sm font-semibold', preset === id ? 'border-white bg-white text-ink-950' : 'border-white/15 text-ink-300 hover:text-white')}>{label}</button>
          ))}
        </div>
        {preset === 'custom' && (
          <>
            <label className="text-xs text-ink-400">From<input type="date" className={`${inputCls} mt-1 h-10`} value={from} max={to} onChange={(e) => setParam({ from: e.target.value })} /></label>
            <label className="text-xs text-ink-400">To<input type="date" className={`${inputCls} mt-1 h-10`} value={to} min={from} max={todayIST()} onChange={(e) => setParam({ to: e.target.value })} /></label>
          </>
        )}
        <label className="text-xs text-ink-400">For
          <select className={`${inputCls} mt-1 h-10`} value={type} onChange={(e) => setParam({ type: e.target.value === 'all' ? null : e.target.value })}>
            <option value="all">Everything</option>
            {(Object.keys(TYPE_LABEL) as PaymentType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>
        </label>
        <label className="text-xs text-ink-400">Method
          <select className={`${inputCls} mt-1 h-10`} value={method} onChange={(e) => setParam({ method: e.target.value === 'all' ? null : e.target.value })}>
            <option value="all">All methods</option>
            {(Object.keys(METHOD_LABEL) as PaymentMethod[]).map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
          </select>
        </label>
        <label className="text-xs text-ink-400">Status
          <select className={`${inputCls} mt-1 h-10`} value={status} onChange={(e) => setParam({ status: e.target.value === 'all' ? null : e.target.value })}>
            <option value="all">Paid and void</option><option value="paid">Paid</option><option value="void">Void</option>
          </select>
        </label>
        <label className="min-w-[14rem] flex-1 text-xs text-ink-400">Search
          <input className={`${inputCls} mt-1 h-10`} placeholder="Member name or receipt no." value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-baseline gap-x-6 gap-y-1" aria-live="polite">
        <p className="text-sm text-ink-400">{fmtDate(from)} – {fmtDate(to)}</p>
        {rows && <p className="text-sm text-white"><span className="font-display text-2xl font-bold tabular-nums">{rupees(total)}</span> received · {shown.filter((p) => p.status === 'paid').length} payment{shown.filter((p) => p.status === 'paid').length === 1 ? '' : 's'}{shown.some((p) => p.status === 'void') && ` · ${shown.filter((p) => p.status === 'void').length} void (not counted)`}</p>}
      </div>
      {rows && rows.length >= LIST_LIMIT && <p className="mt-2 text-xs text-amber-200">Showing the first {LIST_LIMIT} payments in this range — choose a shorter range to see all.</p>}
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">Payments couldn’t load: {error}</p>}

      <div className="mt-5">
        {!rows && !error ? <div className="h-40 animate-pulse rounded-2xl bg-ink-900" role="status" aria-label="Loading payments" /> :
          rows && shown.length === 0 ? (
            <Empty title={rows.length ? 'No payments match' : 'No payments in this period'} body={rows.length ? 'Try a different method, status or search.' : 'Payments you record appear here with their receipts.'}>
              {!rows.length && <Button asChild><Link to="/admin/payments/new"><Plus /> Record payment</Link></Button>}
            </Empty>
          ) : rows && (
            <>
              <div className="hidden overflow-x-auto rounded-2xl border border-white/[0.08] md:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-white/[0.08] text-xs uppercase tracking-wider text-ink-500">
                    <tr>{['Receipt', 'Date', 'Member', 'For', 'Method', 'Amount', 'Status'].map((h) => <th key={h} scope="col" className={cn('px-4 py-3 font-semibold', h === 'Amount' && 'text-right')}>{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {shown.map((p) => (
                      <tr key={p.id} className="hover:bg-white/[0.02]">
                        <td className="px-4 py-3"><Link to={`/admin/payments/${p.id}`} className="font-mono font-semibold text-white hover:text-brand-400">{receiptLabel(p)}</Link></td>
                        <td className="px-4 py-3 text-ink-300">{fmtDate(p.paidOn)}</td>
                        <td className="px-4 py-3 text-white">{p.memberName}</td>
                        <td className="px-4 py-3 text-ink-300">{paymentFor(p)}</td>
                        <td className="px-4 py-3 text-ink-300">{METHOD_LABEL[p.method]}</td>
                        <td className={cn('px-4 py-3 text-right tabular-nums', p.status === 'void' ? 'text-ink-500 line-through' : 'text-white')}>{rupees(p.amountPaise)}</td>
                        <td className="px-4 py-3"><PaymentStatus p={p} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="space-y-3 md:hidden">
                {shown.map((p) => (
                  <li key={p.id}><Link to={`/admin/payments/${p.id}`} className="block rounded-2xl border border-white/[0.08] bg-ink-900 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0"><span className="block truncate font-semibold text-white">{p.memberName}</span><span className="font-mono text-xs text-ink-500">{receiptLabel(p)} · {fmtDate(p.paidOn)}</span></span>
                      <span className={cn('font-display text-xl font-bold tabular-nums', p.status === 'void' ? 'text-ink-500 line-through' : 'text-white')}>{rupees(p.amountPaise)}</span>
                    </div>
                    <p className="mt-2 flex items-center gap-2 text-xs text-ink-400">{METHOD_LABEL[p.method]} · {paymentFor(p)} <PaymentStatus p={p} /></p>
                  </Link></li>
                ))}
              </ul>
            </>
          )}
      </div>
    </AdminShell>
  );
};

export default PaymentsPage;

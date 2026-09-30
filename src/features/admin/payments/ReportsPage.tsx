import { useState } from 'react';
import { Download } from 'lucide-react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { memberState, membersDue, todayIST, type Member } from '@/lib/admin/members';
import { getSettings } from '@/lib/admin/settings';
import { METHOD_LABEL, TYPE_LABEL, monthStart, paymentTypeOf, paymentsBetween, toCsv, downloadCsv as download } from '@/lib/admin/payments';
import { AdminShell, Field, inputCls } from '@/features/events/admin/shared';
import { balanceText } from '@/lib/admin/packages';
import { useLookups } from '@/features/admin/members/lookups';

/** Reports — explicit CSV exports of real data. */
const ReportsPage = () => {
  const { plans, trainers } = useLookups();
  const [from, setFrom] = useState(monthStart(todayIST()));
  const [to, setTo] = useState(todayIST());
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const run = async (key: string, job: () => Promise<string>) => {
    setBusy(key); setMsg(null);
    try { setMsg(await job()); } catch (e) { setMsg(`Couldn’t create the report: ${(e as Error).message}`); } finally { setBusy(null); }
  };
  const planName = (id: string | null) => (id ? plans.get(id)?.duration ?? '' : '');

  const paymentsCsv = () => run('payments', async () => {
    const rows = await paymentsBetween(from, to);
    download(`crunch-payments-${from}-to-${to}.csv`, toCsv([
      ['Receipt', 'Date', 'Member', 'Phone', 'For', 'Plan / package', 'Covers from', 'Covers to', 'Method', 'Reference', 'Amount (INR)', 'Status', 'Void reason', 'Recorded by', 'Source', 'Old sheet row', 'Old sheet bal'],
      ...rows.map((p) => [p.receiptNo ?? '', p.paidOn, p.memberName, p.memberPhone, TYPE_LABEL[paymentTypeOf(p)], p.planName, p.coversFrom, p.coversTo, METHOD_LABEL[p.method], p.reference, (p.amountPaise / 100).toFixed(2), p.status, p.voidReason ?? '', p.createdBy,
        p.source === 'legacy_excel' ? 'Old member sheet' : 'Admin', p.legacy?.row ?? '', balanceText(p.legacy) ?? '']),
    ]));
    const paid = rows.filter((p) => p.status === 'paid');
    return `Downloaded ${rows.length} payments (${paid.length} paid, ${rows.length - paid.length} void).`;
  });
  const membersCsv = () => run('members', async () => {
    const [snap, s] = await Promise.all([getDocs(query(collection(db, 'members'), orderBy('nameLower'))), getSettings()]);
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Member);
    download(`crunch-members-${todayIST()}.csv`, toCsv([
      ['Member ID', 'Name', 'Phone', 'Email', 'Plan', 'Start', 'Expiry', 'Status', 'Trainer'],
      ...list.map((m) => [m.id, m.name, m.phone, m.email, planName(m.planId), m.membershipStart, m.membershipEnd, memberState(m, s.expiringSoonDays), m.trainerId ? trainers.get(m.trainerId)?.name ?? '' : '']),
    ]));
    return `Downloaded ${list.length} members.`;
  });
  const duesCsv = () => run('dues', async () => {
    const s = await getSettings();
    const list = await membersDue(s.expiringSoonDays);
    download(`crunch-dues-${todayIST()}.csv`, toCsv([
      ['Name', 'Phone', 'Plan', 'Expiry', 'Current plan price'],
      ...list.map((m) => [m.name, m.phone, planName(m.planId), m.membershipEnd, m.planId ? plans.get(m.planId)?.price ?? '' : '']),
    ]));
    return `Downloaded ${list.length} renewals due.`;
  });

  return (
    <AdminShell title="Reports" nav="reports" area="Money">
      <p className="-mt-4 mb-8 text-sm text-ink-400">Download spreadsheets (CSV) of live data. Files are created in your browser — open them in Excel or Google Sheets.</p>
      {msg && <p role="status" className="mb-6 rounded-xl border border-white/10 bg-ink-900 p-4 text-sm text-white">{msg}</p>}
      <div className="grid gap-5 lg:grid-cols-3">
        <section aria-labelledby="r-pay" className="rounded-2xl border border-white/[0.08] bg-ink-900 p-5">
          <h2 id="r-pay" className="font-semibold text-white">Payments</h2>
          <p className="mt-1 text-sm text-ink-400">Every payment in a date range, including voided ones (marked).</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Field label="From" htmlFor="rep-from"><input id="rep-from" type="date" className={`${inputCls} h-11`} value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label="To" htmlFor="rep-to"><input id="rep-to" type="date" className={`${inputCls} h-11`} value={to} min={from} onChange={(e) => setTo(e.target.value)} /></Field>
          </div>
          <Button className="mt-4" onClick={paymentsCsv} disabled={!!busy && busy !== 'payments'} loading={busy === 'payments'} loadingText="Preparing…"><Download /> Download payments</Button>
        </section>
        <section aria-labelledby="r-mem" className="rounded-2xl border border-white/[0.08] bg-ink-900 p-5">
          <h2 id="r-mem" className="font-semibold text-white">Members</h2>
          <p className="mt-1 text-sm text-ink-400">All members with plan, dates, current status and trainer.</p>
          <Button className="mt-4" onClick={membersCsv} disabled={!!busy && busy !== 'members'} loading={busy === 'members'} loadingText="Preparing…"><Download /> Download members</Button>
        </section>
        <section aria-labelledby="r-due" className="rounded-2xl border border-white/[0.08] bg-ink-900 p-5">
          <h2 id="r-due" className="font-semibold text-white">Dues</h2>
          <p className="mt-1 text-sm text-ink-400">Expired and soon-expiring memberships with their plan’s current price.</p>
          <Button className="mt-4" onClick={duesCsv} disabled={!!busy && busy !== 'dues'} loading={busy === 'dues'} loadingText="Preparing…"><Download /> Download dues</Button>
        </section>
      </div>
    </AdminShell>
  );
};

export default ReportsPage;

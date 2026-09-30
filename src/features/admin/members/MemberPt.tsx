import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { todayIST, type Member } from '@/lib/admin/members';
import { PERIOD_LABEL, balanceText, logPtSession, periodState, ptPaid, sessionsLeft, type PtPackage } from '@/lib/admin/packages';
import PtPackageForm from './PtPackageForm';
import { useActor } from '@/features/events/admin/actor';
import { fmtDate, type TrainerRef } from './lookups';


/** Personal training — its own packages, trainer, sessions and payments. Never touches the gym membership. */
const MemberPt = ({ m, pt, trainers, onChange, startAdd, onPay }: { m: Member; pt: PtPackage[] | null; trainers: Map<string, TrainerRef>; onChange: () => void; startAdd?: boolean; onPay?: (packageId: string | null) => void }) => {
  const actor = useActor();
  const [adding, setAdding] = useState(!!startAdd);
  const [msg, setMsg] = useState<string | null>(null);
  const today = todayIST();
  const trainerName = (id: string | null) => (id ? trainers.get(id)?.name ?? 'Trainer' : 'Not set');

  const session = async (p: PtPackage) => {
    setMsg(null);
    try { await logPtSession(p, m.name, actor); onChange(); } catch (e) { setMsg((e as Error).message); }
  };

  return (
    <section aria-label="Personal training" className="rounded-2xl border border-white/[0.08] bg-ink-900 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-white">Personal training</h2>
        <div className="flex gap-2">
          {!adding && <Button size="sm" variant="outline" onClick={() => setAdding(true)}><Plus /> Add PT package</Button>}
          {onPay ? <Button size="sm" onClick={() => onPay(null)}>Record PT payment</Button> : <Button asChild size="sm"><Link to={`/admin/payments/new?member=${m.id}&type=pt`}>Record PT payment</Link></Button>}
        </div>
      </div>
      <p className="mt-1 text-xs text-ink-500">PT is separate from the gym membership: it doesn’t extend the membership or open the door.</p>
      {msg && <p role="alert" className="mt-3 text-sm text-red-300">{msg}</p>}

      {adding && (
        <div className="mt-4 rounded-xl border border-white/10 p-4">
          <PtPackageForm m={m} trainers={trainers} onSaved={() => { setAdding(false); onChange(); }} onCancel={() => setAdding(false)} />
        </div>
      )}

      {pt === null ? <div className="mt-4 h-20 animate-pulse rounded-xl bg-ink-800" /> : pt.length === 0 ? <p className="mt-4 text-sm text-ink-400">No PT packages.</p> : (
        <ul className="mt-4 space-y-3" aria-label="PT packages">
          {pt.map((p) => {
            const st = periodState(p, today);
            const left = sessionsLeft(p);
            return (
              <li key={p.id} className={cn('rounded-xl border p-4 text-sm', st === 'current' ? 'border-brand-400/30' : 'border-white/[0.08]')}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-white">{p.packageName}</span>
                  <span className="flex gap-1.5">
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', st === 'current' ? 'bg-brand-400/15 text-brand-fg' : 'bg-white/[0.06] text-ink-400')}>{PERIOD_LABEL[st]}</span>
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', ptPaid(p) ? 'bg-white/[0.06] text-ink-300' : 'bg-amber-400/15 text-amber-100')}>{ptPaid(p) ? 'Paid' : 'Not paid yet'}</span>
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-400">{p.startDate ? `${fmtDate(p.startDate)} – ${fmtDate(p.endDate)}` : 'Dates not recorded'} · Trainer: {p.trainerId ? trainerName(p.trainerId) : 'Trainer not recorded'}</p>
                <p className="text-xs text-ink-400">Sessions: {p.sessionsIncluded != null ? `${p.sessionsUsed ?? 0} used · ${left} left of ${p.sessionsIncluded}` : 'not counted'}</p>
                {balanceText(p) && <p className="text-xs text-ink-500">Old sheet balance column: “{balanceText(p)}”{p.legacyBalanceAmountPaise ? ' (not confirmed — not shown as due)' : ''}</p>}
                {st === 'current' && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {p.sessionsIncluded != null && <Button size="sm" variant="outline" disabled={left === 0} onClick={() => session(p)}>Log a session</Button>}
                    {!ptPaid(p) && (onPay ? <Button size="sm" onClick={() => onPay(p.id)}>Record PT payment</Button> : <Button asChild size="sm"><Link to={`/admin/payments/new?member=${m.id}&type=pt&package=${p.id}`}>Record PT payment</Link></Button>)}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default MemberPt;

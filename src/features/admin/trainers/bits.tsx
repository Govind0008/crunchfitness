import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Field, inputCls } from '@/features/events/admin/shared';
import { useActor } from '@/features/events/admin/actor';
import {
  EXCEPTION_LABEL, LEAVE_STATUS, LEAVE_TYPE, STATUS_LABEL, addManualCheckout, fmtClock, saveLeave, validateLeave,
  type Leave, type LeaveInput, type LeaveStatus, type LeaveType, type TrainerDay, type TrainerDayStatus, type TrainerException,
} from '@/lib/admin/trainerAttendance';
import { Pill, SideDrawer, type Tone } from '../kit';

const STATUS_TONE: Record<TrainerDayStatus, Tone> = { COMPLETED: 'ok', MISSING_CHECKOUT: 'warn', NO_ATTENDANCE_RECORDED: 'muted' };
export const StatusPill = ({ status }: { status: TrainerDayStatus }) => <Pill tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Pill>;

export const Exceptions = ({ list }: { list: TrainerException[] }) => (list.length ? <span className="flex flex-wrap gap-1">{list.map((x) => <Pill key={x} tone={x === 'PUNCH_DURING_APPROVED_LEAVE' ? 'bad' : 'info'}>{EXCEPTION_LABEL[x]}</Pill>)}</span> : null);

/** Close a day that has a check-in but no check-out. Time on that day, after the check-in, with a reason. */
export const ManualCheckout = ({ day, onClose, onDone }: { day: TrainerDay | null; onClose: () => void; onDone: () => void }) => {
  const actor = useActor();
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!day) return;
    if (!/^\d{2}:\d{2}$/.test(time)) { setErr('Enter the time they left.'); return; }
    if (reason.trim().length < 3) { setErr('Say why the check-out is being added (e.g. “forgot to punch out, confirmed by manager”).'); return; }
    setBusy(true); setErr(null);
    try { await addManualCheckout(day, new Date(`${day.date}T${time}:00+05:30`), reason, actor); setTime(''); setReason(''); onDone(); onClose(); }
    catch (x) { setErr((x as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <SideDrawer open={!!day} onOpenChange={(o) => !o && onClose()} title="Add check-out" description={day ? `${day.trainerName} · ${day.date} · checked in ${fmtClock(day.firstAt)}` : undefined}>
      <form onSubmit={submit} className="space-y-5" noValidate aria-label="Manual check-out">
        {err && <p role="alert" className="text-sm text-red-300">{err}</p>}
        <p className="text-sm text-ink-400">Only for a day with a check-in and no check-out. It’s recorded as added by you, with your reason, and shown as a manual check-out.</p>
        <Field label="Left at" htmlFor="mc-time"><input id="mc-time" type="time" className={inputCls} value={time} onChange={(e) => setTime(e.target.value)} /></Field>
        <Field label="Reason" htmlFor="mc-reason"><input id="mc-reason" className={inputCls} value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} /></Field>
        <div className="flex gap-2 border-t border-white/[0.08] pt-5">
          <Button type="submit" loading={busy} loadingText="Saving…">Add check-out</Button>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </SideDrawer>
  );
};

const blankLeave = (trainerId: string): LeaveInput => ({ trainerId, from: '', to: '', type: 'casual', reason: '', status: 'approved', notes: '' });
/** Record or edit a trainer's leave. */
export const LeaveDrawer = ({ open, trainer, existing, onClose, onDone }: { open: boolean; trainer: { id: string; name: string }; existing?: Leave | null; onClose: () => void; onDone: () => void }) => {
  const actor = useActor();
  const [f, setF] = useState<LeaveInput>(existing ?? blankLeave(trainer.id));
  const [shownFor, setShownFor] = useState<string | null>(null);
  const key = open ? existing?.id ?? 'new' : null;
  if (key !== shownFor) { setShownFor(key); setF(existing ? { ...existing } : blankLeave(trainer.id)); }
  const [errs, setErrs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v = validateLeave(f);
    setErrs(v);
    if (v.length) return;
    setBusy(true);
    try { await saveLeave(f, actor, existing ?? undefined); onDone(); onClose(); }
    catch (x) { setErrs([(x as Error).message]); }
    finally { setBusy(false); }
  };
  return (
    <SideDrawer open={open} onOpenChange={(o) => !o && onClose()} title={existing ? 'Edit leave' : 'Record leave'} description={trainer.name}>
      <form onSubmit={submit} className="space-y-5" noValidate aria-label="Leave">
        {errs.length > 0 && <ul role="alert" className="space-y-1 text-sm text-red-300">{errs.map((x) => <li key={x}>{x}</li>)}</ul>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="First day" htmlFor="lv-from"><input id="lv-from" type="date" className={inputCls} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value, to: f.to || e.target.value })} /></Field>
          <Field label="Last day" htmlFor="lv-to"><input id="lv-to" type="date" className={inputCls} value={f.to} min={f.from} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type" htmlFor="lv-type"><select id="lv-type" className={inputCls} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as LeaveType })}>{Object.entries(LEAVE_TYPE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label="Status" htmlFor="lv-status"><select id="lv-status" className={inputCls} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as LeaveStatus })}>{Object.entries(LEAVE_STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        </div>
        <Field label="Reason" htmlFor="lv-reason"><input id="lv-reason" className={inputCls} value={f.reason} maxLength={300} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>
        <Field label="Notes" hint="Optional" htmlFor="lv-notes"><textarea id="lv-notes" rows={3} className={`${inputCls} h-auto py-3`} value={f.notes} maxLength={1000} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        <div className="flex gap-2 border-t border-white/[0.08] pt-5">
          <Button type="submit" loading={busy} loadingText="Saving…">{existing ? 'Save changes' : 'Record leave'}</Button>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </SideDrawer>
  );
};

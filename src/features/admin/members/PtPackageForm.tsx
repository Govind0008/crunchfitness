import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { periodEnd, todayIST, type Member } from '@/lib/admin/members';
import { createPtPackage, validatePtPackage, type PtPackageInput } from '@/lib/admin/packages';
import { Field, inputCls } from '@/features/events/admin/shared';
import { useActor } from '@/features/events/admin/actor';
import type { TrainerRef } from './lookups';

const blank = (): PtPackageInput => ({ packageName: '', trainerId: null, sessionsIncluded: null, startDate: todayIST(), endDate: '', notes: '' });

/** A new PT package for a member (paid now or later). Never touches the gym membership. */
const PtPackageForm = ({ m, trainers, onSaved, onCancel }: { m: Member; trainers: Map<string, TrainerRef>; onSaved: (packageId: string) => void; onCancel: () => void }) => {
  const actor = useActor();
  const [f, setF] = useState<PtPackageInput>(blank);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validatePtPackage(f); setErrors(errs);
    if (errs.length) return;
    setBusy(true);
    try { onSaved(await createPtPackage(m.id, m.name, f, actor)); }
    catch { setErrors(['The PT package couldn’t be saved. Please try again.']); setBusy(false); }
  };
  return (
    <form onSubmit={save} className="grid gap-4 sm:grid-cols-2" noValidate aria-label="New PT package">
      {errors.length > 0 && <div role="alert" className="text-sm text-red-300 sm:col-span-2">{errors.map((x) => <p key={x}>{x}</p>)}</div>}
      <Field label="Package" hint="e.g. 1 Month PT" htmlFor="pt-name"><input id="pt-name" className={inputCls} value={f.packageName} onChange={(e) => {
        const name = e.target.value; const end = periodEnd(f.startDate, name);
        setF({ ...f, packageName: name, endDate: f.endDate || !end ? f.endDate : end });
      }} /></Field>
      <Field label="Trainer" hint="Optional" htmlFor="pt-trainer">
        <select id="pt-trainer" className={inputCls} value={f.trainerId ?? ''} onChange={(e) => setF({ ...f, trainerId: e.target.value || null })}>
          <option value="">Not set</option>
          {[...trainers.values()].map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </Field>
      <Field label="Starts" htmlFor="pt-start"><input id="pt-start" type="date" className={inputCls} value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></Field>
      <Field label="Ends" htmlFor="pt-end"><input id="pt-end" type="date" className={inputCls} value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></Field>
      <Field label="Sessions" hint="Optional — only if a number was agreed" htmlFor="pt-sessions"><input id="pt-sessions" className={inputCls} inputMode="numeric" value={f.sessionsIncluded ?? ''} onChange={(e) => setF({ ...f, sessionsIncluded: e.target.value ? Number(e.target.value.replace(/\D/g, '')) : null })} /></Field>
      <Field label="Notes" hint="Optional" htmlFor="pt-notes"><input id="pt-notes" className={inputCls} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      <p className="text-xs text-ink-500 sm:col-span-2">Personal training is separate from the gym membership — it doesn’t extend it or open the door.</p>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save PT package'}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
};

export default PtPackageForm;

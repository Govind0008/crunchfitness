import { useState, type ReactNode } from 'react';
import { ShieldBan, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { todayIST, type Member } from '@/lib/admin/members';
import { OVERRIDE_LABEL, accessEligibility, type AccessOverride, type BiometricIdentity } from '@/lib/access';
import { setAccessOverride } from '@/lib/access/store';
import { ConfirmButton, Field, inputCls } from '@/features/events/admin/shared';
import { useActor } from '@/features/events/admin/actor';
import BiometricPanel from '@/features/admin/access/BiometricPanel';
import { memberPerson } from '@/features/admin/access/EnrollWizard';
import { fmtDate } from './lookups';

const Tone = ({ tone, children }: { tone: 'ok' | 'bad' | 'wait' | 'muted'; children: ReactNode }) => (
  <span className={cn('inline-flex rounded-full px-2.5 py-1 text-xs font-bold', { ok: 'bg-brand-400/15 text-brand-fg', bad: 'bg-red-500/15 text-red-200', wait: 'bg-amber-400/15 text-amber-100', muted: 'bg-white/[0.06] text-ink-300' }[tone])}>{children}</span>
);

/**
 * A member's door access, kept as separate facts: the MEMBERSHIP rules (what the CRM allows), a
 * staff block, and their BIOMETRIC device user (enrolment, who manages it, the access switch).
 * Attendance lives on its own tab. Nothing here claims the device did something it didn't report.
 */
const MemberAccess = ({ m, identities, onChange, startEnrol }: { m: Member; identities: BiometricIdentity[] | null; onChange: () => void; startEnrol?: boolean }) => {
  const actor = useActor();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const access = accessEligibility(m, todayIST());

  const override = async (o: AccessOverride | null) => {
    if (o && blockReason.trim().length < 3) { setMsg({ ok: false, text: 'Say briefly why access is being stopped.' }); return; }
    await setAccessOverride(m, o, blockReason, actor); setBlockReason(''); setMsg(null); onChange();
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section aria-label="Access control" className="rounded-2xl border border-white/[0.08] bg-ink-900 p-5">
        <h2 className="font-sans text-sm font-bold uppercase tracking-wider text-white">Membership & entry rules</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3"><dt className="text-ink-400">Entry by membership</dt>
            <dd>{access.eligible ? <Tone tone="ok">ALLOWED</Tone> : access.eligible === false ? <Tone tone="bad">NOT ALLOWED</Tone> : <Tone tone="muted">NO MEMBERSHIP</Tone>}</dd></div>
          <p className="text-xs text-ink-500">{access.reason}. Gym entry follows the gym membership only — a PT package on its own doesn’t open the door.</p>
          <div className="flex justify-between gap-3"><dt className="text-ink-400">Membership</dt><dd className="text-right text-white">{m.membershipEnd ? `${m.membershipEnd >= todayIST() ? 'Active until' : 'Ended'} ${fmtDate(m.membershipEnd)}` : 'None on record'}</dd></div>
        </dl>

        <div className="mt-5 border-t border-white/[0.06] pt-4">
          {m.accessOverride ? (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-sm text-red-200"><ShieldBan className="h-4 w-4" aria-hidden /> {OVERRIDE_LABEL[m.accessOverride]}{m.accessOverrideReason ? ` — ${m.accessOverrideReason}` : ''}</p>
              <ConfirmButton size="sm" variant="outline" confirm={{ title: 'Restore access?', body: 'Entry will follow the membership again.' }} onConfirm={() => override(null)}><ShieldCheck /> Enable access</ConfirmButton>
            </div>
          ) : (
            <div className="space-y-3">
              <Field label="Stop access" hint="Blocks entry even with an active membership" htmlFor="acc-reason"><input id="acc-reason" className={cn(inputCls, 'h-11')} value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="Reason, e.g. payment dispute" /></Field>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => override('suspended')}>Suspend membership</Button>
                <Button size="sm" variant="destructive" onClick={() => override('blocked')}><ShieldBan /> Block member</Button>
              </div>
            </div>
          )}
        </div>
        {msg && <p role={msg.ok ? 'status' : 'alert'} className={cn('mt-4 text-sm', msg.ok ? 'text-brand-fg' : 'text-red-300')}>{msg.text}</p>}
      </section>

      <BiometricPanel person={memberPerson(m)} identities={identities} onChange={onChange} startEnrol={startEnrol}
        membership={{ label: m.membershipEnd ? `${m.membershipEnd >= todayIST() ? 'Active until' : 'Ended'} ${fmtDate(m.membershipEnd)}` : 'None on record', ok: access.eligible === true }} />
    </div>
  );
};

export default MemberAccess;

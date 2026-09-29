import { useEffect, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getMember, memberState, searchMembers, type Member } from '@/lib/admin/members';
import { manualCheckIn } from '@/lib/admin/attendance';
import { logAdmin } from '@/lib/admin/activity';
import { DEFAULT_SETTINGS } from '@/lib/admin/settings';
import { formatPhone } from '@/lib/admin/phone';
import { useActor } from '@/features/events/admin/actor';
import { inputCls } from '@/features/events/admin/shared';
import { StatePill } from './members/shared';
import { fmtDate } from './members/lookups';

/**
 * Front-desk check-in: find the member, confirm, done. One manual check-in per member per day.
 * `framed` draws its own card (the Attendance page); inside a drawer it renders bare.
 */
const StaffCheckIn = ({ initialMemberId, autoFocus, onDone, framed = true }: {
  initialMemberId?: string | null; autoFocus?: boolean; onDone: () => void; framed?: boolean;
}) => {
  const actor = useActor();
  const [q, setQ] = useState('');
  const [matches, setMatches] = useState<Member[]>([]);
  const [member, setMember] = useState<Member | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { if (initialMemberId) getMember(initialMemberId).then((m) => m && setMember(m)); }, [initialMemberId]);
  useEffect(() => { if (autoFocus && !initialMemberId) input.current?.focus(); }, [autoFocus, initialMemberId]);
  useEffect(() => {
    if (member || q.trim().length < 2) { setMatches([]); return; }
    const t = setTimeout(() => searchMembers(q).then(setMatches).catch(() => setMatches([])), 250);
    return () => clearTimeout(t);
  }, [q, member]);

  const state = member ? memberState(member, DEFAULT_SETTINGS.expiringSoonDays) : null;
  const checkIn = async () => {
    if (!member) return;
    setBusy(true); setMsg(null);
    try {
      const r = await manualCheckIn(member, actor);
      if (r === 'ok') {
        setMsg({ ok: true, text: `${member.name} is checked in.` });
        logAdmin(actor, 'Member checked in', 'attendance', member.id, { name: member.name, method: 'manual' });
        if (!initialMemberId) { setMember(null); setQ(''); }
        onDone();
      } else setMsg({ ok: false, text: `${member.name} is already checked in today.` });
    } catch {
      setMsg({ ok: false, text: 'Check-in couldn’t be saved. Please try again.' });
    } finally { setBusy(false); }
  };

  const body = (
    <>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={cn('mb-3 flex items-center gap-2 text-sm', msg.ok ? 'text-brand-300' : 'text-amber-200')}>{msg.ok && <CheckCircle2 className="h-4 w-4" aria-hidden />}{msg.text}</p>}
      <div className={cn('grid gap-3', framed && 'md:grid-cols-[1fr_auto] md:items-end')}>
        {member ? (
          <div className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-white/15 px-4 py-2">
            <span className="min-w-0">
              <span className="block truncate font-semibold text-white">{member.name}</span>
              <span className="flex flex-wrap items-center gap-2 text-xs text-ink-400">{formatPhone(member.phone)} {state && <StatePill state={state} />}{member.membershipEnd && `· until ${fmtDate(member.membershipEnd)}`}</span>
            </span>
            {!initialMemberId && <button type="button" className="text-xs text-ink-400 hover:text-white" onClick={() => { setMember(null); setMsg(null); }}>Change</button>}
          </div>
        ) : (
          <label className="relative block text-xs text-ink-400">Member
            <input ref={input} className={`${inputCls} mt-1`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or phone number" autoComplete="off" />
            {matches.length > 0 && (
              <ul className="absolute inset-x-0 top-full z-10 mt-1 divide-y divide-white/[0.06] rounded-xl border border-white/10 bg-ink-900 shadow-xl" aria-label="Matching members">
                {matches.map((m) => (
                  <li key={m.id}><button type="button" onClick={() => { setMember(m); setQ(''); setMsg(null); }} className="flex w-full justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-white/[0.04]">
                    <span className="text-white">{m.name}</span><span className="tabular-nums text-ink-400">{formatPhone(m.phone)}</span>
                  </button></li>
                ))}
              </ul>
            )}
          </label>
        )}
        <Button size="lg" disabled={!member || busy} onClick={checkIn}>{busy ? 'Checking in…' : 'Check in'}</Button>
      </div>
      {member && (state === 'expired' || state === 'inactive') && <p className="mt-2 text-xs text-amber-200">Their membership isn’t active — you can still record the visit, then renew.</p>}
    </>
  );

  if (!framed) return body;
  return (
    <section aria-labelledby="staff-checkin-h" className="rounded-2xl border border-brand-400/25 bg-ink-900 p-5">
      <h2 id="staff-checkin-h" className="mb-4 font-sans text-sm font-bold uppercase tracking-wider text-white">Check in a member</h2>
      {body}
    </section>
  );
};

export default StaffCheckIn;

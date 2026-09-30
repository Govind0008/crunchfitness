import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SearchCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { addDays, todayIST } from '@/lib/admin/members';
import { ISSUE_LABEL, admsCall, type BackfillResult, type IssueKind, type Reconciliation } from '@/lib/access/admsApi';
import { ConfirmButton } from '@/features/events/admin/shared';
import { EmptyNote, ErrorNote, Pill } from '../kit';

const REPAIRABLE: IssueKind[] = ['missing_member_attendance', 'missing_trainer_attendance'];
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '');

/**
 * Checks stored punches against attendance for a date range, and — only after staff review the
 * preview and confirm — creates the attendance that's missing. Punches themselves are never
 * changed, and nothing is matched by name: unlinked device users are listed for staff to link.
 */
const AttendanceCheck = () => {
  const today = todayIST();
  const [from, setFrom] = useState(addDays(today, -6));
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [r, setR] = useState<Reconciliation | null>(null);
  const [done, setDone] = useState<BackfillResult | null>(null);

  const preview = async () => {
    setBusy(true); setError(null); setDone(null);
    try { setR(await admsCall<Reconciliation>('reconcile', { params: { from, to } })); }
    catch (e) { setError((e as Error).message); setR(null); }
    finally { setBusy(false); }
  };
  const repair = async () => {
    try { setDone(await admsCall<BackfillResult>('backfill', { method: 'POST', params: { from, to } })); await preview(); }
    catch (e) { setError((e as Error).message); }
  };
  const repairable = r ? REPAIRABLE.reduce((n, k) => n + (r.counts[k] ?? 0), 0) : 0;
  const kinds = r ? (Object.keys(r.counts) as IssueKind[]) : [];

  return (
    <section aria-labelledby="chk-h" className="max-w-4xl">
      <h2 id="chk-h" className="font-sans text-sm font-bold uppercase tracking-wider text-white">Attendance check</h2>
      <p className="mt-1 text-sm text-ink-400">Every member punch should be in that member’s attendance, and every trainer punch in trainer attendance. Check a date range, review what’s missing, then repair it.</p>

      <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); void preview(); }}>
        <label className="text-sm text-ink-400">From<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="mt-1 block h-10 rounded-lg border border-white/15 bg-field px-2 text-white focus:border-brand-400 focus:outline-none" /></label>
        <label className="text-sm text-ink-400">To<input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} className="mt-1 block h-10 rounded-lg border border-white/15 bg-field px-2 text-white focus:border-brand-400 focus:outline-none" /></label>
        <Button type="submit" disabled={busy || !from || !to}><SearchCheck /> {busy ? 'Checking…' : 'Check'}</Button>
      </form>

      {error && <div className="mt-4"><ErrorNote what="The check couldn’t run." error={error} onRetry={preview} /></div>}
      {done && <p role="status" className="mt-4 rounded-xl border border-brand-400/25 bg-brand-400/[0.06] p-4 text-sm text-brand-100">Repaired: {done.attendanceCreated} attendance record{done.attendanceCreated === 1 ? '' : 's'} created, {done.attendanceUpdated} updated, from {done.considered} punch{done.considered === 1 ? '' : 'es'}.</p>}

      {r && (
        <div className="mt-5 space-y-4">
          <p className="text-sm text-ink-300">Checked {r.eventsChecked} punch{r.eventsChecked === 1 ? '' : 'es'} and {r.attendanceChecked} attendance record{r.attendanceChecked === 1 ? '' : 's'}{r.truncated ? ' — the range has more punches than one check reads; narrow it to see everything.' : '.'}</p>
          {kinds.length === 0 ? <EmptyNote title="All consistent" body="Every punch in this range is in attendance, and every device user is linked." /> : (
            <>
              <div className="flex flex-wrap gap-2">{kinds.map((k) => <Pill key={k} tone={REPAIRABLE.includes(k) ? 'warn' : k === 'unknown_uid' ? 'info' : 'bad'}>{ISSUE_LABEL[k]}: {r.counts[k]}</Pill>)}</div>
              {repairable > 0 && (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-400/[0.06] p-4 text-sm text-amber-100">
                  <p className="flex-1">{repairable} punch{repairable === 1 ? '' : 'es'} can be added to attendance. The punches stay exactly as they are.</p>
                  <ConfirmButton size="sm" onConfirm={repair} confirm={{ title: 'Create missing attendance?', body: `Adds ${repairable} punch${repairable === 1 ? '' : 'es'} from ${from} to ${to} to the attendance of the member or trainer they’re linked to. Running it again changes nothing.` }}>Create missing attendance</ConfirmButton>
                </div>
              )}
              <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.08] bg-ink-900" aria-label="Attendance issues">
                {r.issues.slice(0, 200).map((x, i) => (
                  <li key={`${x.kind}-${x.eventId ?? x.attendanceId ?? x.deviceUserId ?? i}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <span className="min-w-0">
                      <span className="block font-semibold text-white">{ISSUE_LABEL[x.kind]}{x.personName ? ` · ${x.personName}` : ''}</span>
                      <span className="text-xs text-ink-400">{x.detail}{x.at ? ` · ${when(x.at)}` : ''}{x.count && x.kind === 'unknown_uid' ? ` · ${x.count} punch${x.count === 1 ? '' : 'es'}` : ''}</span>
                    </span>
                    {x.kind === 'unknown_uid' && x.deviceId && <Link to={`/admin/settings/access/${x.deviceId}/users`} className="text-xs font-semibold text-brand-fg hover:underline">Link device user {x.deviceUserId}</Link>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
};

export default AttendanceCheck;

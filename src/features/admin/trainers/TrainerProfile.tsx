import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { collection, query, where } from 'firebase/firestore';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { memberCode, type Member } from '@/lib/admin/members';
import { activityFor } from '@/lib/admin/activity';
import { ENROLLMENT_LABEL, MANAGED_LABEL, enrollmentOf, managedByOf } from '@/lib/access';
import BiometricPanel from '../access/BiometricPanel';
import { identitiesOfTrainer } from '@/lib/access/store';
import { listTeam } from '@/lib/admin/trainerAttendance';
import { fmtTime } from '@/features/admin/members/lookups';
import { AdminShell } from '@/features/events/admin/shared';
import { useCached } from '../useCached';
import { usePaged } from '../usePaged';
import { EmptyNote, ErrorNote, ListBox, Pagination, Pill, SkeletonRows } from '../kit';

// Trainer attendance and leave are kept in the gym's separate HR platform, not here
const TABS = [['overview', 'Overview'], ['access', 'Biometric'], ['members', 'Assigned members'], ['activity', 'Activity']] as const;
type Tab = (typeof TABS)[number][0];
/** One trainer: fingerprint access, assigned members, activity. */
const TrainerProfile = () => {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find(([t]) => t === params.get('tab'))?.[0] ?? 'overview') as Tab;
  const go = (t: Tab) => setParams(t === 'overview' ? {} : { tab: t }, { replace: true });
  const team = useCached(['team'], listTeam);
  const trainer = team.data?.find((t) => t.id === id);
  const ids = useCached(['trainerIds', id], () => identitiesOfTrainer(id));
  const log = useCached(['trainerActivity', id], () => activityFor(id, 50), tab === 'activity');
  const membersBase = useMemo(() => query(collection(db, 'members'), where('trainerId', '==', id)), [id]);
  const members = usePaged(`trainerMembers:${id}`, tab === 'members' ? membersBase : null, (d) => ({ id: d.id, ...d.data() }) as Member, 25);

  if (team.data && !trainer) return <AdminShell title="Trainer not found" nav="trainers" area="People" back={{ to: '/admin/trainers', label: 'Trainers' }}><EmptyNote title="No such trainer" body="The profile may have been removed." /></AdminShell>;

  return (
    <AdminShell title={trainer?.name ?? 'Trainer'} nav="trainers" area="People" back={{ to: '/admin/trainers', label: 'Trainers' }}
      subtitle={trainer?.role ?? ''} actions={<Button asChild variant="outline"><Link to="/admin/team"><Pencil /> Edit profile</Link></Button>}>
      <div role="tablist" aria-label="Trainer" className="-mt-1 mb-4 flex flex-shrink-0 gap-1 overflow-x-auto border-b border-white/[0.08]">
        {TABS.map(([t, label]) => (
          <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => go(t)}
            className={cn('whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors', tab === t ? 'border-brand-400 text-white' : 'border-transparent text-ink-400 hover:text-white')}>{label}</button>
        ))}
      </div>
      {tab === 'overview' && (
        <div className="grid max-w-2xl gap-6">
          <section aria-labelledby="ov-dev" className="rounded-2xl border border-white/[0.08] bg-ink-900 p-5">
            <div className="flex items-center justify-between"><h2 id="ov-dev" className="font-sans text-sm font-bold uppercase tracking-wider text-white">Fingerprint</h2><button type="button" onClick={() => go('access')} className="text-xs text-ink-400 hover:text-white">Manage →</button></div>
            {!ids.data ? <div className="mt-4 h-12 animate-pulse rounded-xl bg-ink-800" /> : ids.data.filter((i) => i.status !== 'REMOVED').length === 0 ? (
              <p className="mt-3 text-sm text-ink-400">Not enrolled on the fingerprint device yet. <button type="button" onClick={() => go('access')} className="font-semibold text-brand-fg hover:underline">Enroll fingerprint</button>.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">{ids.data.filter((i) => i.status !== 'REMOVED').map((i) => <li key={i.id} className="flex flex-wrap items-center gap-2"><span className="font-mono text-white">#{i.deviceUserId}</span><Pill tone={enrollmentOf(i) === 'confirmed' ? 'ok' : 'muted'}>{ENROLLMENT_LABEL[enrollmentOf(i)]}</Pill><Pill tone="muted">{MANAGED_LABEL[managedByOf(i)]}</Pill></li>)}</ul>
            )}
          </section>
        </div>
      )}

      {tab === 'access' && trainer && (
        <div className="max-w-2xl">
          <BiometricPanel person={{ id: trainer.id, name: trainer.name, personType: 'trainer', code: trainer.role }} identities={ids.data} onChange={ids.refetch} />
        </div>
      )}

      {tab === 'members' && (
        <section aria-labelledby="mem-h">
          <h2 id="mem-h" className="font-sans mb-4 text-sm font-bold uppercase tracking-wider text-white">Assigned members</h2>
          {members.error ? <ErrorNote what="Couldn’t load members." error={members.error} onRetry={members.refetch} /> : !members.rows ? <SkeletonRows rows={4} /> : members.rows.length === 0 ? <EmptyNote title="No assigned members" body="Members show here when this trainer is set on their profile." /> : (
            <ListBox label="Assigned members">
              {members.rows.map((m) => <li key={m.id}><Link to={`/admin/members/${m.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-white/[0.03]"><span className="truncate font-semibold text-white">{m.name}</span><span className="font-mono text-xs text-ink-500">{memberCode(m.id)}</span></Link></li>)}
            </ListBox>
          )}
          <Pagination p={members} label="Assigned members" count={members.rows?.length} />
        </section>
      )}

      {tab === 'activity' && (
        <section aria-labelledby="log-h" className="rounded-2xl border border-white/[0.08] bg-ink-900 p-5">
          <h2 id="log-h" className="font-sans text-sm font-bold uppercase tracking-wider text-white">Activity</h2>
          {log.error ? <div className="mt-4"><ErrorNote what="Couldn’t load activity." error={log.error} /></div> : !log.data ? <div className="mt-4 h-16 animate-pulse rounded-xl bg-ink-800" /> : log.data.length === 0 ? <p className="mt-4 text-sm text-ink-400">No recorded activity yet.</p> : (
            <ul className="mt-3 divide-y divide-white/[0.06] text-sm">
              {log.data.map((a) => <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2"><span className="text-white">{a.action}{a.meta?.date ? ` · ${a.meta.date}` : ''}</span><span className="text-xs text-ink-500">{fmtTime(a.at)} · {a.actorEmail}</span></li>)}
            </ul>
          )}
        </section>
      )}
    </AdminShell>
  );
};

export default TrainerProfile;

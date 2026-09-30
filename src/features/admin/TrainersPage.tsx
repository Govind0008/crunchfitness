import { useState, type FormEvent } from 'react';
import { useCached } from './useCached';
import { Link, useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import TrainerAttendanceBoard from './trainers/TrainerAttendanceBoard';
import { KeyRound, Pencil } from 'lucide-react';
import { collection, getCountFromServer, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { todayIST } from '@/lib/admin/members';
import { createTrainerLogin, listTrainerLogins, removeTrainerLogin, type TrainerLogin } from '@/lib/admin/staff';
import { AdminShell, ConfirmButton, Field, inputCls } from '@/features/events/admin/shared';
import { useActor } from '@/features/events/admin/actor';
import { EmptyNote, ErrorNote, Pill, SideDrawer, SkeletonRows } from './kit';

interface TrainerRow {
  id: string; name: string; role?: string; specialization?: string; image?: string; visible?: boolean;
  login?: TrainerLogin; members: number; clients: number; upcoming: number;
}

/** Every team profile with its members, PT clients, upcoming PT and portal login — one parallel round. */
async function loadTrainers(): Promise<TrainerRow[]> {
  const today = todayIST();
  const [team, logins] = await Promise.all([getDocs(collection(db, 'teamMembers')), listTrainerLogins()]);
  const list = await Promise.all(team.docs.map(async (d) => {
    const t = d.data();
    const [members, clients, upcoming] = await Promise.all([
      getCountFromServer(query(collection(db, 'members'), where('trainerId', '==', d.id))).then((c) => c.data().count).catch(() => 0),
      getCountFromServer(collection(db, 'trainerData', d.id, 'clients')).then((c) => c.data().count).catch(() => 0),
      getCountFromServer(query(collection(db, 'trainerData', d.id, 'sessions'), where('date', '>=', today))).then((c) => c.data().count).catch(() => 0),
    ]);
    return { id: d.id, name: t.name, role: t.role, specialization: t.specialization, image: t.image, visible: t.visible, login: logins.find((l) => l.trainerId === d.id), members, clients, upcoming } as TrainerRow;
  }));
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

/** Trainers — who looks after whom, and who can sign in to the trainer portal. */
const TrainersPage = () => {
  const actor = useActor();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'attendance' ? 'attendance' : 'team';
  const [loginFor, setLoginFor] = useState<TrainerRow | null>(null);
  const [form, setForm] = useState({ email: '', password: '' });
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: rows, error, refetch: load } = useCached(['trainers'], loadTrainers);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!loginFor) return;
    if (!form.email.includes('@') || form.password.length < 8) { setFormErr('Add an email and a password of at least 8 characters.'); return; }
    setBusy(true); setFormErr(null);
    try { await createTrainerLogin({ ...form, trainerId: loginFor.id, name: loginFor.name }, actor); setLoginFor(null); load(); }
    catch (err) {
      const code = (err as { code?: string }).code ?? '';
      setFormErr(code.includes('email-already-in-use') ? 'That email already has an account.' : code.includes('weak-password') ? 'Choose a stronger password.' : 'The login couldn’t be created. Please try again.');
    } finally { setBusy(false); }
  };
  const withLogin = (rows ?? []).filter((r) => r.login).length;

  return (
    <AdminShell title="Trainers" nav="trainers" area="People" fill={tab === 'attendance'} subtitle={rows ? `${rows.length} on the team · ${withLogin} with a portal login` : '…'}
      actions={<Button asChild variant="outline"><Link to="/admin/team"><Pencil /> Edit profiles</Link></Button>}>
      <div role="tablist" aria-label="Trainers" className="-mt-1 mb-4 flex flex-shrink-0 gap-1 overflow-x-auto border-b border-white/[0.08]">
        {([['team', 'Team'], ['attendance', 'Attendance']] as const).map(([t, label]) => (
          <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => setParams(t === 'team' ? {} : { tab: t }, { replace: true })}
            className={cn('whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors', tab === t ? 'border-brand-400 text-white' : 'border-transparent text-ink-400 hover:text-white')}>{label}</button>
        ))}
      </div>
      {tab === 'attendance' && <TrainerAttendanceBoard />}
      {tab === 'team' && error && <div className="mb-5"><ErrorNote what="Couldn’t load trainers." error={error} onRetry={load} /></div>}
      {tab !== 'team' ? null : !rows ? <SkeletonRows rows={3} /> : rows.length === 0 ? (
        <EmptyNote title="No trainers yet" body="Add coaches in Team — they appear on the website and can be given a trainer-portal login."><Button asChild><Link to="/admin/team">Open Team</Link></Button></EmptyNote>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Trainers">
          {rows.map((t) => (
            <li key={t.id} className="flex flex-col rounded-2xl border border-white/[0.08] bg-ink-900 p-5">
              <div className="flex items-center gap-4">
                {t.image ? <img src={t.image} alt="" className="h-14 w-14 rounded-full object-cover" loading="lazy" /> : <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ink-800 font-bold text-white" aria-hidden>{t.name?.[0]}</span>}
                <div className="min-w-0">
                  <h2 className="truncate font-display text-2xl font-bold uppercase leading-tight text-white"><Link to={`/admin/trainers/${t.id}`} className="hover:underline">{t.name}</Link></h2>
                  <p className="truncate text-sm text-ink-400">{t.role}{t.specialization ? ` · ${t.specialization}` : ''}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Pill tone={t.login ? 'ok' : 'muted'}>{t.login ? 'Portal login' : 'No portal login'}</Pill>
                {t.visible === false && <Pill tone="muted">Hidden on website</Pill>}
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                {([['Members', t.members], ['PT clients', t.clients], ['Upcoming PT', t.upcoming]] as const).map(([k, v]) => (
                  <div key={k} className="flex flex-col-reverse rounded-xl bg-ink-800 p-2"><dt className="text-[11px] text-ink-400">{k}</dt><dd className="font-display text-2xl font-bold tabular-nums text-white">{v}</dd></div>
                ))}
              </dl>
              <div className="mt-auto pt-4">
                {t.login ? (
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-ink-300">{t.login.email}</span>
                    <ConfirmButton size="sm" variant="secondary" confirm={{ title: `Remove ${t.name}’s portal login?`, body: 'They will no longer be able to sign in to the trainer portal. Their profile and clients stay.' }}
                      onConfirm={async () => { await removeTrainerLogin(t.login!, actor); load(); }}>Remove login</ConfirmButton>
                  </div>
                ) : <Button size="sm" variant="outline" onClick={() => { setLoginFor(t); setForm({ email: '', password: '' }); setFormErr(null); }}><KeyRound /> Give portal login</Button>}
              </div>
            </li>
          ))}
        </ul>
      )}

      <SideDrawer open={!!loginFor} onOpenChange={(o) => !o && setLoginFor(null)} title="Portal login" description={loginFor ? `For ${loginFor.name}. They’ll see their own PT clients and sessions — nothing else.` : undefined}>
        <form onSubmit={create} className="space-y-5" noValidate aria-label="Trainer login">
          {formErr && <p role="alert" className="text-sm text-red-300">{formErr}</p>}
          <Field label="Email" htmlFor="tl-email"><input id="tl-email" type="email" autoComplete="off" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Password" hint="At least 8 characters — share it privately" htmlFor="tl-pw"><input id="tl-pw" type="password" autoComplete="new-password" className={inputCls} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
          <div className="flex gap-2 border-t border-white/[0.08] pt-5">
            <Button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create login'}</Button>
            <Button type="button" variant="ghost" onClick={() => setLoginFor(null)}>Cancel</Button>
          </div>
        </form>
      </SideDrawer>
    </AdminShell>
  );
};

export default TrainersPage;

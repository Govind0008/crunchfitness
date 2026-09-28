import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, Pencil, CalendarRange } from 'lucide-react';
import { collection, getCountFromServer, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { todayIST } from '@/lib/admin/members';
import { classesOn, type ClassSession } from '@/lib/admin/attendance';
import { AdminShell, Empty } from '@/features/events/admin/shared';

interface TrainerRow {
  id: string; name: string; role?: string; specialization?: string; image?: string; visible?: boolean;
  hasLogin: boolean; duty?: { shift: string; area: string; days: string[] }; classes: ClassSession[];
  members: number; clients: number; upcoming: number;
}

// Same week convention as the Duty Roster screen
const weekStart = () => { const d = new Date(); const day = d.getDay(); d.setDate(d.getDate() - day + (day === 0 ? -6 : 1)); return d.toISOString().split('T')[0]; };

/** Trainers — who is working, what they're running today, and who they look after. */
const TrainersPage = () => {
  const [rows, setRows] = useState<TrainerRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const today = todayIST();
        const [team, logins, duties, classes] = await Promise.all([
          getDocs(collection(db, 'teamMembers')),
          getDocs(query(collection(db, 'userRoles'), where('role', '==', 'trainer'))),
          getDocs(query(collection(db, 'duties'), where('weekStart', '==', weekStart()))),
          classesOn(today),
        ]);
        const loginIds = new Set(logins.docs.map((d) => d.data().trainerId as string));
        const list = await Promise.all(team.docs.map(async (d) => {
          const t = d.data();
          const [members, clients, upcoming] = await Promise.all([
            getCountFromServer(query(collection(db, 'members'), where('trainerId', '==', d.id))).then((c) => c.data().count).catch(() => 0),
            getCountFromServer(collection(db, 'trainerData', d.id, 'clients')).then((c) => c.data().count).catch(() => 0),
            getCountFromServer(query(collection(db, 'trainerData', d.id, 'sessions'), where('date', '>=', today))).then((c) => c.data().count).catch(() => 0),
          ]);
          const duty = duties.docs.map((x) => x.data()).find((x) => x.trainerId === d.id);
          return {
            id: d.id, name: t.name, role: t.role, specialization: t.specialization, image: t.image, visible: t.visible,
            hasLogin: loginIds.has(d.id), duty: duty ? { shift: duty.shift, area: duty.area, days: duty.days ?? [] } : undefined,
            classes: classes.filter((c) => c.trainerId === d.id), members, clients, upcoming,
          } as TrainerRow;
        }));
        setRows(list.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (e) { setError((e as Error).message); }
    })();
  }, []);

  return (
    <AdminShell title="Trainers" nav="trainers" area="People"
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link to="/admin/dashboard?tab=team"><Pencil /> Edit profiles</Link></Button>
          <Button asChild variant="outline"><Link to="/admin/dashboard?tab=accounts"><KeyRound /> Portal logins</Link></Button>
          <Button asChild variant="outline"><Link to="/admin/dashboard?tab=roster"><CalendarRange /> Duty roster</Link></Button>
        </div>
      }>
      {error && <p role="alert" className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">Couldn’t load trainers: {error}</p>}
      {!rows ? <div className="h-40 animate-pulse rounded-2xl bg-ink-900" /> : rows.length === 0 ? (
        <Empty title="No trainers yet" body="Add coaches in Edit profiles — they appear on the Team page and can be given a trainer-portal login." />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((t) => (
            <li key={t.id} className="rounded-2xl border border-white/[0.08] bg-ink-900 p-5">
              <div className="flex items-center gap-4">
                {t.image ? <img src={t.image} alt="" className="h-14 w-14 rounded-full object-cover" loading="lazy" /> : <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ink-800 font-bold text-white" aria-hidden>{t.name?.[0]}</span>}
                <div className="min-w-0">
                  <h2 className="truncate font-display text-2xl font-bold uppercase leading-tight text-white">{t.name}</h2>
                  <p className="truncate text-sm text-ink-400">{t.role}{t.specialization ? ` · ${t.specialization}` : ''}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className={t.hasLogin ? 'rounded-full bg-brand-400/15 px-2.5 py-1 font-bold text-brand-300' : 'rounded-full bg-white/10 px-2.5 py-1 text-ink-300'}>{t.hasLogin ? 'Portal login' : 'No portal login'}</span>
                {t.visible === false && <span className="rounded-full bg-white/10 px-2.5 py-1 text-ink-300">Hidden on website</span>}
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[['Members', t.members], ['PT clients', t.clients], ['Upcoming PT', t.upcoming]].map(([k, v]) => (
                  <div key={k as string} className="rounded-xl bg-ink-800 p-2"><dd className="font-display text-2xl font-bold tabular-nums text-white">{v}</dd><dt className="text-[11px] text-ink-400">{k}</dt></div>
                ))}
              </dl>
              <p className="mt-4 text-sm text-ink-300"><span className="text-ink-500">This week: </span>{t.duty ? `${t.duty.shift} · ${t.duty.area} · ${t.duty.days.join(', ')}` : 'Not on the roster'}</p>
              <p className="mt-1 text-sm text-ink-300"><span className="text-ink-500">Today: </span>{t.classes.length ? t.classes.map((c) => `${c.startTime} ${c.title}`).join(' · ') : 'No classes'}</p>
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
};

export default TrainersPage;

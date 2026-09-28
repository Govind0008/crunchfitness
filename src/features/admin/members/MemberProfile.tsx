import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ClipboardCheck, IndianRupee, Link2, Pencil, Trash2 } from 'lucide-react';
import { collection, collectionGroup, doc, documentId, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { deleteMember, getMember, linkTrainerClient, memberCode, memberState, todayIST, type Member } from '@/lib/admin/members';
import { ACCESS_CONNECTED, accessEligibility } from '@/lib/access';
import { checkInsForPhone, periodStarts, type CheckInRecord } from '@/lib/admin/attendance';
import { METHOD_LABEL, TYPE_LABEL, paymentTypeOf, paymentsOfMember, receiptLabel, rupees, type Payment, type PaymentType } from '@/lib/admin/payments';
import { PERIOD_LABEL, currentPt, membershipsOf, periodState, ptPackagesOf, type MembershipRecord, type PtPackage } from '@/lib/admin/packages';
import { getSettings } from '@/lib/admin/settings';
import { formatPhone, phoneKey } from '@/lib/admin/phone';
import { STATUS, formatEventDate, formatScore, passNumber, type Category, type CrunchEvent, type Result } from '@/lib/events';
import { AdminShell, ConfirmButton, Empty, inputCls } from '@/features/events/admin/shared';
import { useActor } from '@/features/events/admin/actor';
import { StatePill } from './shared';
import { fmtDate, fmtTime, useLookups } from './lookups';

const Card = ({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) => (
  <section aria-label={title} className="rounded-2xl border border-white/[0.08] bg-ink-900 p-5">
    <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-bold uppercase tracking-wider text-white">{title}</h2>{action}</div>
    <div className="mt-4">{children}</div>
  </section>
);
const PeriodTag = ({ state }: { state: ReturnType<typeof periodState> }) => (
  <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', state === 'current' ? 'bg-brand-400/15 text-brand-300' : 'bg-white/[0.06] text-ink-400')}>{PERIOD_LABEL[state]}</span>
);
const Row = ({ k, v }: { k: string; v: ReactNode }) => (
  <div className="flex justify-between gap-4 py-1.5 text-sm"><dt className="text-ink-400">{k}</dt><dd className="text-right text-white">{v}</dd></div>
);

interface Training { goal?: string; plans: { id: string; name: string }[]; logs: { id: string; date: string; weight?: number; notes?: string }[]; sessions: { id: string; date: string; time: string; status: string }[] }
interface EventEntry { ev: CrunchEvent; number: number; status: string; result?: Result; category?: Category }

/** One member, everything that relates to them — pulled from the records that already exist. */
const MemberProfile = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const actor = useActor();
  const { plans, trainers } = useLookups();
  const [m, setM] = useState<Member | null | undefined>(undefined);
  const [expDays, setExpDays] = useState(14);
  const [visits, setVisits] = useState<CheckInRecord[] | null>(null);
  const [classNames, setClassNames] = useState<Map<string, string>>(new Map());
  const [training, setTraining] = useState<Training | null>(null);
  const [events, setEvents] = useState<EventEntry[] | null>(null);
  const [linkOptions, setLinkOptions] = useState<{ trainerId: string; clientId: string; name: string; phone: string }[] | null>(null);
  const [linkChoice, setLinkChoice] = useState('');
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [payFilter, setPayFilter] = useState<PaymentType | 'all'>('all');
  const [memberships, setMemberships] = useState<MembershipRecord[] | null>(null);
  const [pt, setPt] = useState<PtPackage[] | null>(null);
  useEffect(() => {
    paymentsOfMember(id).then(setPayments).catch(() => setPayments([]));
    membershipsOf(id).then(setMemberships).catch(() => setMemberships([]));
    ptPackagesOf(id).then(setPt).catch(() => setPt([]));
  }, [id]);

  const reload = () => getMember(id).then(setM);
  useEffect(() => { reload(); getSettings().then((s) => setExpDays(s.expiringSoonDays)); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Attendance: class check-ins matched by phone
  useEffect(() => {
    if (!m) return;
    checkInsForPhone(m.phone).then(async (recs) => {
      setVisits(recs);
      // One query for the class names of the last 10 check-ins (not one read per row)
      const ids = [...new Set(recs.slice(0, 10).map((r) => r.sessionId))];
      if (!ids.length) return;
      const s = await getDocs(query(collection(db, 'classSessions'), where(documentId(), 'in', ids))).catch(() => null);
      setClassNames(new Map(s?.docs.map((d) => [d.id, (d.data().title as string) ?? 'Class'] as const) ?? []));
    }).catch(() => setVisits([]));
  }, [m]);

  // Training: only when linked to the trainer portal's client record
  useEffect(() => {
    if (!m?.trainerClient) { setTraining(null); return; }
    const { trainerId, clientId } = m.trainerClient;
    const base = ['trainerData', trainerId] as const;
    Promise.all([
      getDoc(doc(db, ...base, 'clients', clientId)),
      getDocs(query(collection(db, ...base, 'workoutPlans'), where('assignedClientIds', 'array-contains', clientId))),
      getDocs(query(collection(db, ...base, 'clients', clientId, 'progressLogs'), orderBy('date', 'desc'), limit(5))),
      getDocs(query(collection(db, ...base, 'sessions'), where('clientId', '==', clientId))),
    ]).then(([c, wp, pl, ss]) => setTraining({
      goal: c.data()?.goal,
      plans: wp.docs.map((d) => ({ id: d.id, name: d.data().name })),
      logs: pl.docs.map((d) => ({ id: d.id, ...(d.data() as { date: string; weight?: number; notes?: string }) })),
      sessions: ss.docs.map((d) => ({ id: d.id, ...(d.data() as { date: string; time: string; status: string }) })).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5),
    })).catch(() => setTraining({ plans: [], logs: [], sessions: [] }));
  }, [m]);

  // Events: registrations matched by phone, across events
  useEffect(() => {
    if (!m) return;
    const key = phoneKey(m.phone);
    type Reg = { eventId: string; id: string; number: number; status: string; categoryId: string };
    // One collection-group query across all events; if its index/rule isn't deployed yet, fall back
    // to checking the 50 most recent events one by one (the previous behaviour).
    const viaGroup = () => getDocs(query(collectionGroup(db, 'registrations'), where('phoneKey', '==', key), limit(50)))
      .then((s) => s.docs.map((d) => ({ eventId: d.ref.parent.parent!.id, id: d.id, ...(d.data() as Omit<Reg, 'eventId' | 'id'>) })));
    const perEvent = async () => {
      const evSnap = await getDocs(query(collection(db, 'events'), orderBy('eventDate', 'desc'), limit(50)));
      const lists = await Promise.all(evSnap.docs.map((e) => getDocs(query(collection(db, 'events', e.id, 'registrations'), where('phoneKey', '==', key)))
        .then((s) => s.docs.map((d) => ({ eventId: e.id, id: d.id, ...(d.data() as Omit<Reg, 'eventId' | 'id'>) }))).catch(() => [] as Reg[])));
      return lists.flat();
    };
    viaGroup().catch(perEvent).then(async (regs) => {
      const found = await Promise.all(regs.map(async (reg): Promise<EventEntry | null> => {
        const [e, res] = await Promise.all([getDoc(doc(db, 'events', reg.eventId)), getDoc(doc(db, 'events', reg.eventId, 'results', reg.id)).catch(() => null)]);
        if (!e.exists()) return null;
        const ev = { id: e.id, ...e.data() } as CrunchEvent;
        const result = res?.exists() ? ({ id: res.id, ...res.data() } as Result) : undefined;
        return { ev, number: reg.number, status: reg.status, result, category: ev.categories?.find((c) => c.id === reg.categoryId) };
      }));
      setEvents(found.filter((x): x is EventEntry => !!x).sort((a, b) => b.ev.eventDate.localeCompare(a.ev.eventDate)));
    }).catch(() => setEvents([]));
  }, [m]);

  const periods = useMemo(() => periodStarts(), []);
  const inPeriod = (since: { seconds: number }) => (visits ?? []).filter((v) => (v.checkedInAt?.seconds ?? 0) >= since.seconds).length;

  const findLinks = async () => {
    // Trainer client records with the same phone number, across trainers
    const key = m ? phoneKey(m.phone) : '';
    const opts: NonNullable<typeof linkOptions> = [];
    await Promise.all([...trainers.keys()].map(async (tid) => {
      const s = await getDocs(collection(db, 'trainerData', tid, 'clients')).catch(() => null);
      s?.docs.forEach((d) => { const c = d.data(); if (phoneKey(c.phone ?? '') === key || (m && c.name?.toLowerCase() === m.name.toLowerCase())) opts.push({ trainerId: tid, clientId: d.id, name: c.name, phone: c.phone ?? '' }); });
    }));
    setLinkOptions(opts);
    setLinkChoice(opts[0] ? `${opts[0].trainerId}/${opts[0].clientId}` : '');
  };

  if (m === undefined) return <AdminShell title="Member" nav="members" area="People"><div className="h-40 animate-pulse rounded-2xl bg-ink-900" /></AdminShell>;
  if (m === null) return <AdminShell title="Member not found" nav="members" area="People" back={{ to: '/admin/members', label: 'Members' }}><Empty title="No such member" body="They may have been deleted." /></AdminShell>;

  const state = memberState(m, expDays);
  const plan = m.planId ? plans.get(m.planId) : undefined;
  const daysLeft = m.membershipEnd ? Math.round((new Date(`${m.membershipEnd}T00:00:00`).getTime() - new Date(`${todayIST()}T00:00:00`).getTime()) / 86400000) : null;
  const trainer = m.trainerId ? trainers.get(m.trainerId) : undefined;
  const today = todayIST();
  const ptNow = pt ? currentPt(pt, today) : null;
  const ptTrainer = ptNow?.trainerId ? trainers.get(ptNow.trainerId)?.name : null;
  const access = accessEligibility(m, today);
  const shownPayments = (payments ?? []).filter((p) => payFilter === 'all' || paymentTypeOf(p) === payFilter);

  return (
    <AdminShell title={m.name} nav="members" area="People" back={{ to: '/admin/members', label: 'Members' }}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild><Link to={`/admin/payments/new?member=${m.id}`}><IndianRupee /> Record payment</Link></Button>
          <Button asChild variant="outline"><Link to={`/admin/attendance?member=${m.id}`}><ClipboardCheck /> Check in</Link></Button>
          <Button asChild variant="outline"><Link to={`/admin/members/${m.id}/edit`}><Pencil /> Edit member</Link></Button>
        </div>
      }>
      <dl className="-mt-4 mb-8 grid grid-cols-2 gap-x-6 gap-y-3 rounded-2xl border border-white/[0.08] bg-ink-900 p-4 text-sm sm:grid-cols-4 xl:grid-cols-7" aria-label="Member summary">
        {[
          ['Member ID', <span className="font-mono">{memberCode(m.id)}</span>],
          ['Phone', <a href={`tel:${m.phone}`} className="tabular-nums hover:underline">{formatPhone(m.phone)}</a>],
          ['Plan', plan ? plan.duration : 'No plan'],
          ['Status', <StatePill state={state} />],
          ['Expiry', m.membershipEnd ? fmtDate(m.membershipEnd) : 'Not set'],
          ['Trainer', trainer?.name ?? '—'],
          ['PT', pt === null ? '…' : ptNow ? `Active${ptTrainer ? ` · ${ptTrainer}` : ''}` : 'No active package'],
        ].map(([k, v]) => <div key={k as string} className="min-w-0"><dt className="text-xs text-ink-500">{k}</dt><dd className="mt-0.5 truncate font-semibold text-white">{v}</dd></div>)}
      </dl>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Membership">
          <dl>
            <Row k="Plan" v={plan ? `${plan.duration}${plan.price ? ` · ${plan.price}` : ''}` : m.planId ? 'Plan no longer exists' : '—'} />
            <Row k="Status" v={<StatePill state={state} />} />
            <Row k="Started" v={fmtDate(m.membershipStart) || '—'} />
            <Row k="Expires" v={m.membershipEnd ? `${fmtDate(m.membershipEnd)}${daysLeft != null ? ` · ${daysLeft >= 0 ? `${daysLeft} days left` : `${-daysLeft} days ago`}` : ''}` : 'No expiry set'} />
            <Row k="Added" v={`${fmtDate(m.createdAt)} · ${m.source === 'import' ? 'CSV import' : m.source === 'trainer_client' ? 'from trainer clients' : m.source === 'legacy_excel' ? 'old member sheet' : 'manually'}`} />
          </dl>
          <div className="mt-4 border-t border-white/[0.06] pt-3 text-sm">
            <p className="flex justify-between gap-3"><span className="text-ink-400">Gym entry</span>
              <span className={access.eligible ? 'text-brand-300' : access.eligible === false ? 'text-red-300' : 'text-ink-300'}>{access.eligible ? 'Allowed' : access.eligible === false ? 'Not allowed' : 'Check membership'}</span></p>
            <p className="mt-1 text-xs text-ink-500">{access.reason}.{ptNow && !access.eligible ? ' Personal training alone doesn’t give gym entry.' : ''} {ACCESS_CONNECTED ? '' : 'The door device isn’t connected yet.'}</p>
          </div>
          <div className="mt-4 border-t border-white/[0.06] pt-3">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-400">Membership history</p>
            {memberships === null ? <div className="mt-2 h-10 animate-pulse rounded bg-ink-800" /> : memberships.length === 0 ? <p className="mt-2 text-xs text-ink-500">No earlier periods on record.</p> : (
              <ul className="mt-2 space-y-2 text-sm" aria-label="Membership history">
                {memberships.map((r) => (
                  <li key={r.id}>
                    <div className="flex justify-between gap-3"><span className="text-white">{r.planLabel}</span><PeriodTag state={periodState(r, today)} /></div>
                    <p className="text-xs text-ink-500">{fmtDate(r.startDate)} – {fmtDate(r.endDate)}{r.source === 'legacy_excel' ? ' · from the old member sheet' : ''}</p>
                    {r.legacyBalanceNote && <p className="text-xs text-ink-500">Old sheet “bal”: {r.legacyBalanceNote}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card title="Personal training" action={<Link to={`/admin/payments/new?member=${m.id}&type=pt`} className="text-xs font-semibold text-brand-400 hover:underline">Record PT payment</Link>}>
          {pt === null ? <div className="h-20 animate-pulse rounded-xl bg-ink-800" /> : (
            <>
              {ptNow ? (
                <dl>
                  <Row k="Package" v={ptNow.packageName} />
                  <Row k="Trainer" v={ptTrainer ?? 'Not set'} />
                  <Row k="Started" v={fmtDate(ptNow.startDate) || '—'} />
                  <Row k="Ends" v={fmtDate(ptNow.endDate) || '—'} />
                  {ptNow.sessionsIncluded != null && <Row k="Sessions" v={`${ptNow.sessionsRemaining != null ? `${ptNow.sessionsRemaining} left of ` : ''}${ptNow.sessionsIncluded}`} />}
                  <Row k="Status" v={<PeriodTag state="current" />} />
                </dl>
              ) : <p className="text-sm text-ink-400">No active PT package.</p>}
              <p className="mt-4 text-xs font-bold uppercase tracking-wider text-ink-400">PT history</p>
              {pt.filter((x) => x !== ptNow).length === 0 ? <p className="mt-2 text-xs text-ink-500">No earlier PT packages.</p> : (
                <ul className="mt-2 space-y-2 text-sm" aria-label="PT history">
                  {pt.filter((x) => x !== ptNow).map((x) => (
                    <li key={x.id}>
                      <div className="flex justify-between gap-3"><span className="text-white">{x.packageName}</span><PeriodTag state={periodState(x, today)} /></div>
                      <p className="text-xs text-ink-500">{x.startDate ? `${fmtDate(x.startDate)} – ${fmtDate(x.endDate)}` : 'Dates not recorded'} · {x.trainerId ? trainers.get(x.trainerId)?.name ?? 'Trainer' : 'Trainer not recorded'}{x.sessionsIncluded != null ? ` · ${x.sessionsIncluded} sessions` : ''}</p>
                      {x.legacyBalanceNote && <p className="text-xs text-ink-500">Old sheet “bal”: {x.legacyBalanceNote}{x.legacyBalanceAmountPaise ? ' (not confirmed — not shown as due)' : ''}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </Card>

        <Card title="Attendance">
          {visits === null ? <div className="h-20 animate-pulse rounded-xl bg-ink-800" /> : (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[['Today', inPeriod(periods.today)], ['This week', inPeriod(periods.week)], ['This month', inPeriod(periods.month)]].map(([k, v]) => (
                  <div key={k as string} className="rounded-xl bg-ink-800 p-3"><p className="font-display text-3xl font-bold tabular-nums text-white">{v}</p><p className="text-xs text-ink-400">{k}</p></div>
                ))}
              </div>
              <p className="mt-3 text-sm text-ink-400">Total check-ins: <span className="text-white">{visits.length}</span>{visits[0] && <> · Last: <span className="text-white">{fmtTime(visits[0].checkedInAt)}</span></>}</p>
              {visits.length > 0 && (
                <ol className="mt-3 space-y-1 text-sm" aria-label="Recent check-ins">
                  {visits.slice(0, 10).map((v) => <li key={v.id} className="flex justify-between gap-3"><span className="text-ink-300">{classNames.get(v.sessionId) ?? 'Class'}</span><span className="tabular-nums text-ink-500">{fmtTime(v.checkedInAt)}</span></li>)}
                </ol>
              )}
              {visits.length === 0 && <p className="mt-2 text-xs text-ink-500">No class check-ins found for this phone number.</p>}
            </>
          )}
        </Card>

        <Card title="Contact">
          <dl>
            <Row k="Phone" v={<a href={`tel:${m.phone}`} className="underline-offset-4 hover:underline">{formatPhone(m.phone)}</a>} />
            <Row k="Email" v={m.email ? <a href={`mailto:${m.email}`} className="break-all underline-offset-4 hover:underline">{m.email}</a> : '—'} />
          </dl>
          {m.notes && <p className="mt-3 whitespace-pre-line rounded-xl bg-ink-800 p-3 text-sm text-ink-200">{m.notes}</p>}
        </Card>

        <Card title="Trainer" action={m.trainerClient
          ? <button type="button" className="text-xs text-ink-400 hover:text-white" onClick={async () => { await linkTrainerClient(m, null, actor); reload(); }}>Unlink</button>
          : <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-400 hover:underline" onClick={findLinks}><Link2 className="h-3.5 w-3.5" /> Link trainer record</button>}>
          <p className="text-white">{trainer?.name ?? 'No trainer assigned'}</p>
          {trainer?.role && <p className="text-sm text-ink-400">{trainer.role}</p>}
          {m.trainerClient ? <p className="mt-2 text-xs text-brand-300">Linked to the trainer portal — training data shows below.</p>
            : <p className="mt-2 text-xs text-ink-500">Not linked to a trainer-portal client record.</p>}
          {linkOptions && !m.trainerClient && (
            linkOptions.length ? (
              <div className="mt-4 space-y-2">
                <label className="block text-xs text-ink-400">Matching trainer clients
                  <select className={`${inputCls} mt-1 h-11`} value={linkChoice} onChange={(e) => setLinkChoice(e.target.value)}>
                    {linkOptions.map((o) => <option key={`${o.trainerId}/${o.clientId}`} value={`${o.trainerId}/${o.clientId}`}>{o.name} · {trainers.get(o.trainerId)?.name ?? o.trainerId}</option>)}
                  </select>
                </label>
                <Button size="sm" onClick={async () => { const [trainerId, clientId] = linkChoice.split('/'); await linkTrainerClient(m, { trainerId, clientId }, actor); setLinkOptions(null); reload(); }}>Link</Button>
              </div>
            ) : <p className="mt-3 text-xs text-ink-400">No trainer client with this phone number or name.</p>
          )}
        </Card>

        {m.trainerClient && (
          <Card title="Training">
            {!training ? <div className="h-20 animate-pulse rounded-xl bg-ink-800" /> : (
              <div className="space-y-4 text-sm">
                {training.goal && <p><span className="text-ink-400">Goal:</span> <span className="text-white">{training.goal}</span></p>}
                <div><p className="text-ink-400">Workout plans</p>{training.plans.length ? <ul className="mt-1 text-white">{training.plans.map((p) => <li key={p.id}>• {p.name}</li>)}</ul> : <p className="text-ink-500">None assigned</p>}</div>
                <div><p className="text-ink-400">Recent progress</p>{training.logs.length ? <ul className="mt-1 space-y-0.5">{training.logs.map((l) => <li key={l.id} className="flex justify-between"><span className="text-ink-300">{fmtDate(l.date)}</span><span className="text-white">{l.weight ? `${l.weight} kg` : l.notes?.slice(0, 30) ?? ''}</span></li>)}</ul> : <p className="text-ink-500">No progress logged</p>}</div>
                <div><p className="text-ink-400">PT sessions</p>{training.sessions.length ? <ul className="mt-1 space-y-0.5">{training.sessions.map((s) => <li key={s.id} className="flex justify-between"><span className="text-ink-300">{fmtDate(s.date)} {s.time}</span><span className="capitalize text-white">{s.status}</span></li>)}</ul> : <p className="text-ink-500">No sessions</p>}</div>
              </div>
            )}
          </Card>
        )}

        <Card title="Payments" action={<Link to={`/admin/payments/new?member=${m.id}`} className="text-xs font-semibold text-brand-400 hover:underline">Record payment</Link>}>
          {payments === null ? <div className="h-20 animate-pulse rounded-xl bg-ink-800" /> : payments.length === 0 ? <p className="text-sm text-ink-400">No payments recorded.</p> : (
            <>
              <div className="flex flex-wrap gap-1" role="group" aria-label="Show payments for">
                {(['all', 'membership', 'pt', 'other'] as const).map((t) => (
                  <button key={t} type="button" aria-pressed={payFilter === t} onClick={() => setPayFilter(t)}
                    className={cn('rounded-full border px-3 py-1 text-xs font-semibold', payFilter === t ? 'border-white bg-white text-ink-950' : 'border-white/15 text-ink-300 hover:text-white')}>
                    {t === 'all' ? 'All' : t === 'pt' ? 'PT' : TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-sm text-ink-400">Total paid: <span className="text-white">{rupees(shownPayments.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amountPaise, 0))}</span></p>
              {shownPayments.length === 0 && <p className="mt-2 text-sm text-ink-500">None of this type.</p>}
              <ul className="mt-3 space-y-2 text-sm" aria-label="Payment history">
                {shownPayments.slice(0, 12).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3">
                    <Link to={`/admin/payments/${p.id}`} className="min-w-0 hover:text-brand-400"><span className="font-mono text-xs text-ink-400">{receiptLabel(p)}</span> <span className="text-ink-300">{fmtDate(p.paidOn)} · {paymentTypeOf(p) === 'pt' ? 'PT' : TYPE_LABEL[paymentTypeOf(p)]} · {METHOD_LABEL[p.method]}</span></Link>
                    <span className={p.status === 'void' ? 'tabular-nums text-ink-500 line-through' : 'tabular-nums text-white'}>{rupees(p.amountPaise)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <Card title="Events">
          {events === null ? <div className="h-20 animate-pulse rounded-xl bg-ink-800" /> : events.length === 0 ? <p className="text-sm text-ink-400">No event registrations with this phone number.</p> : (
            <ul className="space-y-3 text-sm">
              {events.map(({ ev, number, status, result, category }) => (
                <li key={ev.id}>
                  <Link to={`/admin/events/${ev.id}`} className="font-semibold text-white hover:text-brand-400">{ev.title}</Link>
                  <p className="text-xs text-ink-400">{formatEventDate(ev.eventDate)} · #{passNumber(number)} · {status === 'checked_in' ? 'Checked in' : status === 'no_show' ? 'No-show' : 'Registered'} · {STATUS[ev.status].admin}</p>
                  {result && category && <p className="text-xs text-brand-300">Result: {formatScore(result.score, category)}{result.position ? ` · Position ${result.position}` : ''}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <section className="mt-12 rounded-2xl border border-red-500/25 p-5">
        <h2 className="font-semibold text-white">Delete member</h2>
        <p className="mt-1 text-sm text-ink-400">Removes this member record. Check-ins, trainer records and event registrations are kept.</p>
        <ConfirmButton variant="destructive" size="default" className="mt-4" confirm={{ title: `Delete ${m.name}?`, body: 'The member record is removed from the members list. This can’t be undone.' }}
          onConfirm={async () => { await deleteMember(m, actor); navigate('/admin/members', { replace: true }); }}>
          <Trash2 /> Delete member
        </ConfirmButton>
      </section>
    </AdminShell>
  );
};

export default MemberProfile;

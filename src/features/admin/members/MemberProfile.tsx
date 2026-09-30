import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, ClipboardCheck, Dumbbell, Fingerprint, IndianRupee, Link2, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { collection, collectionGroup, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DUES_LOOKBACK_DAYS, addDays, deleteMember, getMember, linkTrainerClient, memberCode, memberState, todayIST, type Member } from '@/lib/admin/members';
import { ACCESS_CONNECTED, BIOMETRIC_LABEL, RESULT_LABEL, accessEligibility, type AccessEvent, type BiometricIdentity } from '@/lib/access';
import { accessEventsOfMember, identitiesOfMember } from '@/lib/access/store';
import { activityFor, type ActivityEntry } from '@/lib/admin/activity';
import { checkInsForPhone, manualCheckInsOf, periodStarts } from '@/lib/admin/attendance';
import { METHOD_LABEL, PAYMENT_LABEL, TYPE_LABEL, parsePrice, paymentTypeOf, paymentsOfMember, receiptLabel, rupees, type Payment, type PaymentType } from '@/lib/admin/payments';
import { PERIOD_LABEL, balanceText, currentPt, membershipsOf, periodState, ptPackagesOf, sessionsLeft, type MembershipRecord, type PtPackage } from '@/lib/admin/packages';
import { getSettings } from '@/lib/admin/settings';
import { formatPhone, phoneKey } from '@/lib/admin/phone';
import { STATUS, formatEventDate, formatScore, passNumber, type Category, type CrunchEvent, type Result } from '@/lib/events';
import { AdminShell, ConfirmButton, Empty, inputCls } from '@/features/events/admin/shared';
import { useActor } from '@/features/events/admin/actor';
import { StatePill } from './shared';
import { fmtDate, fmtTime, useLookups } from './lookups';
import PhotoControl from './PhotoControl';
import PtPackageForm from './PtPackageForm';
import EnrollWizard from './EnrollWizard';
import PaymentForm from '@/features/admin/payments/PaymentForm';
import StaffCheckIn from '@/features/admin/StaffCheckIn';
import { EmptyNote, SideDrawer, SkeletonRows, StatusDot } from '@/features/admin/kit';
import MemberAccess from './MemberAccess';
import MemberPt from './MemberPt';
import { cachedMember } from '@/features/admin/useCached';

const Card = ({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) => (
  <section aria-label={title} className="rounded-2xl border border-white/[0.08] bg-ink-900 p-5">
    <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-bold uppercase tracking-wider text-white">{title}</h2>{action}</div>
    <div className="mt-4">{children}</div>
  </section>
);
const PeriodTag = ({ state }: { state: ReturnType<typeof periodState> }) => (
  <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', state === 'current' ? 'bg-brand-400/15 text-brand-300' : 'bg-white/[0.06] text-ink-400')}>{PERIOD_LABEL[state]}</span>
);
const Story = ({ title, action, children }: { title: string; action?: { label: string; onClick: () => void }; children: ReactNode }) => (
  <div className="flex flex-col rounded-2xl border border-white/[0.08] bg-ink-900 p-5 transition-colors hover:border-white/15">
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-ink-400">{title}</h2>
      {action && <button type="button" onClick={action.onClick} className="text-xs font-semibold text-brand-400 hover:underline">{action.label}</button>}
    </div>
    <div className="flex-1">{children}</div>
  </div>
);
const Row = ({ k, v }: { k: string; v: ReactNode }) => (
  <div className="flex justify-between gap-4 py-1.5 text-sm"><dt className="text-ink-400">{k}</dt><dd className="text-right text-white">{v}</dd></div>
);

interface Visit { id: string; at: number; kind: 'manual' | 'biometric'; how: string; ok: boolean }
const fmtWhen = (ms: number) => (ms ? new Date(ms).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');

type Tab = 'overview' | 'membership' | 'pt' | 'payments' | 'attendance' | 'access' | 'events' | 'activity';
const TABS: [Tab, string][] = [['overview', 'Overview'], ['membership', 'Membership'], ['pt', 'PT'], ['payments', 'Payments'], ['attendance', 'Attendance'], ['access', 'Access'], ['events', 'Events'], ['activity', 'Activity']];

interface Training { goal?: string; plans: { id: string; name: string }[]; logs: { id: string; date: string; weight?: number; notes?: string }[]; sessions: { id: string; date: string; time: string; status: string }[] }
interface EventEntry { ev: CrunchEvent; number: number; status: string; result?: Result; category?: Category }

/** One member, everything that relates to them — pulled from the records that already exist. */
const MemberProfile = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const actor = useActor();
  const { plans, trainers } = useLookups();
  // From a cached list when we came from one: the header shows at once, then refreshes
  const [m, setM] = useState<Member | null | undefined>(() => cachedMember(id) ?? undefined);
  const [expDays, setExpDays] = useState(14);
  const [visitFilter, setVisitFilter] = useState<'all' | 'biometric' | 'manual'>('all');
  const [training, setTraining] = useState<Training | null>(null);
  const [events, setEvents] = useState<EventEntry[] | null>(null);
  const [linkOptions, setLinkOptions] = useState<{ trainerId: string; clientId: string; name: string; phone: string }[] | null>(null);
  const [linkChoice, setLinkChoice] = useState('');
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [payFilter, setPayFilter] = useState<PaymentType | 'all'>('all');
  const [memberships, setMemberships] = useState<MembershipRecord[] | null>(null);
  const [pt, setPt] = useState<PtPackage[] | null>(null);
  const [identities, setIdentities] = useState<BiometricIdentity[] | null>(null);
  const [scans, setScans] = useState<AccessEvent[] | null>(null);
  const [log, setLog] = useState<ActivityEntry[] | null>(null);
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find(([t]) => t === params.get('tab'))?.[0] ?? 'overview') as Tab;
  const notice = params.get('notice');
  // Common tasks open in a side drawer, so the profile stays on screen
  const [drawer, setDrawerState] = useState<'renew' | 'payment' | 'pt' | 'access' | 'checkin' | null>(null);
  const [drawerType, setDrawerType] = useState<PaymentType | null>(null);
  const [drawerPackage, setDrawerPackage] = useState<string | null>(null);
  const [paid, setPaid] = useState<{ id: string; type: PaymentType; amount: string; member: string } | null>(null);
  const setDrawer = (d: typeof drawer, pay?: { type: PaymentType; packageId: string | null }) => {
    if (d === 'renew' || d === 'payment') { setDrawerType(pay?.type ?? 'membership'); setDrawerPackage(pay?.packageId ?? null); }
    setDrawerState(d);
  };
  useEffect(() => { if (params.has('enroll')) setDrawer('access'); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    identitiesOfMember(id).then(setIdentities).catch(() => setIdentities([]));
    accessEventsOfMember(id).then(setScans).catch(() => setScans([]));
  }, [id]);
  // Activity loads when its tab opens
  useEffect(() => { if (tab === 'activity' && log === null) activityFor(id).then(setLog).catch(() => setLog([])); }, [tab, id, log]);
  useEffect(() => {
    paymentsOfMember(id).then(setPayments).catch(() => setPayments([]));
    membershipsOf(id).then(setMemberships).catch(() => setMemberships([]));
    ptPackagesOf(id).then(setPt).catch(() => setPt([]));
  }, [id]);

  const reload = () => getMember(id).then(setM);
  useEffect(() => { reload(); getSettings().then((s) => setExpDays(s.expiringSoonDays)); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Manual attendance: front-desk check-ins (by member id — starts at once, without waiting for
  // the member record), plus earlier self check-ins matched by phone
  const [desk, setDesk] = useState<Visit[] | null>(null);
  const [earlier, setEarlier] = useState<Visit[] | null>(null);
  const loadDesk = () => manualCheckInsOf(id).catch(() => []).then((rows) => setDesk(rows.map((r): Visit => ({ id: `m-${r.id}`, at: r.at?.toMillis() ?? 0, kind: 'manual', how: 'Manual · front desk', ok: true }))));
  useEffect(() => { setDesk(null); loadDesk(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setEarlier(null);
    if (!m?.phone) return;
    checkInsForPhone(m.phone).catch(() => []).then((rows) => setEarlier(rows.map((r): Visit => ({ id: `c-${r.id}`, at: r.checkedInAt?.toMillis() ?? 0, kind: 'manual', how: 'Manual · earlier self check-in', ok: true }))));
  }, [m?.phone]);
  const manual = useMemo(() => (desk && earlier ? [...desk, ...earlier] : null), [desk, earlier]);

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
  }, [m?.trainerClient?.trainerId, m?.trainerClient?.clientId]); // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [m?.phone]); // eslint-disable-line react-hooks/exhaustive-deps

  const periods = useMemo(() => periodStarts(), []);
  // One attendance history: manual check-ins and door scans (a refused scan isn't a visit)
  const history = useMemo<Visit[] | null>(() => (manual && scans ? [...manual, ...scans.map((e): Visit => ({
    id: `s-${e.id}`, at: new Date(e.at).getTime(), kind: 'biometric', ok: e.result === 'granted',
    how: `Biometric${e.result === 'granted' ? '' : ` · ${RESULT_LABEL[e.result]}`}`,
  }))].sort((a, b) => b.at - a.at) : null), [manual, scans]);
  const visits = history?.filter((v) => v.ok) ?? null;
  const inPeriod = (since: { seconds: number }) => (visits ?? []).filter((v) => v.at >= since.seconds * 1000).length;

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
  const lastPayment = (payments ?? []).find((p) => p.status === 'paid');
  const liveIds = (identities ?? []).filter((i) => i.status !== 'REMOVED');
  const renewalDue = m.membershipEnd && m.membershipEnd <= addDays(today, expDays) && m.membershipEnd >= addDays(today, -DUES_LOOKBACK_DAYS) && m.status === 'active';
  const renewalPaise = plan ? (parsePrice(plan.price) ?? null) : null;
  const go = (t: Tab) => setParams((p) => { const n = new URLSearchParams(p); if (t === 'overview') n.delete('tab'); else n.set('tab', t); n.delete('enroll'); n.delete('add'); return n; }, { replace: true });

  const totalPaid = (payments ?? []).filter((p) => p.status === 'paid').reduce((sum, p) => sum + p.amountPaise, 0);
  const visitsThisMonth = inPeriod(periods.month);
  const lastScan = scans?.[0];
  const bio = liveIds[0];
  const membershipTone = state === 'active' ? 'ok' : state === 'expiring' ? 'warn' : state === 'expired' ? 'bad' : 'muted';
  const closeDrawer = () => { setDrawer(null); setPaid(null); };
  const refresh = () => { reload(); paymentsOfMember(id).then(setPayments); ptPackagesOf(id).then(setPt); identitiesOfMember(id).then(setIdentities); };

  return (
    <AdminShell title={m.name} nav="members" area="People" back={{ to: '/admin/members', label: 'Members' }} bare>
      {notice && <p role="alert" className="mb-6 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">{notice}</p>}

      <header className="mb-8 flex flex-col gap-6 rounded-2xl border border-white/[0.08] bg-ink-900 p-5 sm:flex-row sm:items-start sm:p-6">
        <PhotoControl m={m} onChanged={reload} />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-4xl font-bold uppercase leading-none text-white sm:text-5xl">{m.name}</h1>
          <p className="mt-2 text-sm text-ink-400">Member ID <span className="font-mono text-ink-200">{memberCode(m.id)}</span> · <a href={`tel:${m.phone}`} className="tabular-nums hover:text-white">{formatPhone(m.phone)}</a></p>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
            <StatusDot tone={membershipTone}>{state === 'active' ? 'Active membership' : state === 'expiring' ? 'Membership expiring soon' : state === 'expired' ? 'Membership expired' : m.membershipEnd ? 'Inactive' : 'No membership'}</StatusDot>
            <StatusDot tone={access.eligible ? 'ok' : access.eligible === false ? 'bad' : 'muted'}>{access.eligible ? 'Access enabled' : access.eligible === false ? 'Access not allowed' : 'No gym access'}</StatusDot>
            {ptNow && <StatusDot tone="info">PT active</StatusDot>}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={() => setDrawer('renew')}><RefreshCw /> Renew</Button>
            <Button variant="outline" onClick={() => setDrawer('payment')}><IndianRupee /> Payment</Button>
            <Button variant="outline" onClick={() => setDrawer('pt')}><Dumbbell /> Add PT</Button>
            <Button variant="outline" onClick={() => setDrawer('access')}><Fingerprint /> Access</Button>
            <Button variant="outline" onClick={() => setDrawer('checkin')}><ClipboardCheck /> Check in</Button>
            <Button asChild variant="ghost"><Link to={`/admin/members/${m.id}/edit`}><Pencil /> Edit</Link></Button>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-white/[0.06] pt-4 text-sm sm:grid-cols-3 lg:grid-cols-5" aria-label="Member summary">
            {[
              ['Plan', plan ? plan.duration : 'No plan'],
              ['Status', <StatePill state={state} />],
              ['Expiry', m.membershipEnd ? fmtDate(m.membershipEnd) : 'Not set'],
              ['Trainer', trainer?.name ?? '—'],
              ['PT', pt === null ? '…' : ptNow ? `Active${ptTrainer ? ` · ${ptTrainer}` : ''}` : 'No active package'],
            ].map(([k, v]) => <div key={k as string} className="min-w-0"><dt className="text-xs text-ink-500">{k}</dt><dd className="mt-0.5 break-words font-semibold text-white">{v}</dd></div>)}
          </dl>
        </div>
      </header>

      <div role="tablist" aria-label="Member sections" className="mb-6 flex gap-1 overflow-x-auto border-b border-white/[0.08]">
        {TABS.map(([t, label]) => (
          <button key={t} role="tab" type="button" id={`tab-${t}`} aria-selected={tab === t} aria-controls={`panel-${t}`} onClick={() => go(t)}
            className={cn('whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition-colors', tab === t ? 'border-brand-400 text-white' : 'border-transparent text-ink-400 hover:text-white')}>{label}</button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
      {tab === 'overview' && (
        <>
          {/* The whole story on one screen; tabs hold the history */}
          <section aria-label="Overview" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Story title="Membership" action={{ label: 'Renew membership', onClick: () => setDrawer('renew') }}>
              <p className="font-display text-2xl font-bold uppercase text-white">{plan?.duration ?? (m.membershipEnd ? 'Membership' : 'No membership')}</p>
              <p className="mt-1 text-sm text-ink-300">{m.membershipStart ? fmtDate(m.membershipStart) : '—'} → {m.membershipEnd ? fmtDate(m.membershipEnd) : 'no expiry'}</p>
              <p className="mt-2 text-xs text-ink-500">{daysLeft != null ? (daysLeft >= 0 ? `${daysLeft} days left` : `Ended ${-daysLeft} days ago`) : 'No expiry date on record'}</p>
            </Story>
            <Story title="Personal training" action={{ label: ptNow ? 'Manage PT' : 'Add PT package', onClick: () => (ptNow ? go('pt') : setDrawer('pt')) }}>
              {ptNow ? (
                <>
                  <p className="font-display text-2xl font-bold uppercase text-white">{ptNow.packageName}</p>
                  <p className="mt-1 text-sm text-ink-300">{sessionsLeft(ptNow) != null ? `${sessionsLeft(ptNow)} of ${ptNow.sessionsIncluded ?? '?'} sessions left` : 'Sessions not counted'}</p>
                  <p className="mt-2 text-xs text-ink-500">Trainer: {ptTrainer ?? 'not set'} · until {fmtDate(ptNow.endDate)}</p>
                </>
              ) : <p className="text-sm text-ink-400">No active PT package.{(pt ?? []).length ? ` ${(pt ?? []).length} earlier.` : ''}</p>}
            </Story>
            <Story title="Payments" action={{ label: 'Collect payment', onClick: () => setDrawer('payment') }}>
              <p className="font-display text-2xl font-bold text-white">{payments ? rupees(totalPaid) : '…'}</p>
              <p className="mt-1 text-sm text-ink-300">{lastPayment ? `Last: ${rupees(lastPayment.amountPaise)} · ${PAYMENT_LABEL[paymentTypeOf(lastPayment)]} · ${fmtDate(lastPayment.paidOn)}` : 'No payments recorded'}</p>
              <p className="mt-2 text-xs text-ink-500">No recorded dues{renewalDue && renewalPaise != null ? ` · estimated next renewal ${rupees(renewalPaise * 100)}` : ''}</p>
            </Story>
            <Story title="Attendance" action={{ label: 'Check in member', onClick: () => setDrawer('checkin') }}>
              <p className="font-display text-2xl font-bold uppercase text-white">{visits === null ? '…' : visits[0] ? fmtWhen(visits[0].at) : 'No visits yet'}</p>
              <p className="mt-1 text-sm text-ink-300">{visits ? `${visitsThisMonth} this month · ${visits.length} in total` : ''}</p>
              <p className="mt-2 text-xs text-ink-500">{visits?.[0] ? `Last visit · ${visits[0].how.split(' · ')[0]}` : 'Manual and biometric visits'}</p>
            </Story>
            <Story title="Access" action={{ label: 'Manage access', onClick: () => go('access') }}>
              <StatusDot tone={access.eligible ? 'ok' : access.eligible === false ? 'bad' : 'muted'}>{access.eligible ? 'Enabled' : access.eligible === false ? 'Not allowed' : 'No membership'}</StatusDot>
              <p className="mt-2 text-sm text-ink-300">Fingerprint: {identities === null ? '…' : bio ? (bio.status === 'SYNCED' || bio.status === 'ENROLLED' ? '✓ Enrolled' : BIOMETRIC_LABEL[bio.status]) : 'Not enrolled'}</p>
              <p className="mt-2 text-xs text-ink-500">{access.reason}{lastScan ? ` · last scan ${new Date(lastScan.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` : ''}</p>
            </Story>
          </section>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
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
          </div>
      <section className="mt-10 rounded-2xl border border-red-500/25 p-5">
        <h2 className="font-semibold text-white">Delete member</h2>
        <p className="mt-1 text-sm text-ink-400">Removes this member record. Check-ins, trainer records and event registrations are kept.</p>
        <ConfirmButton variant="destructive" size="default" className="mt-4" confirm={{ title: `Delete ${m.name}?`, body: 'The member record is removed from the members list. This can’t be undone.' }}
          onConfirm={async () => { await deleteMember(m, actor); navigate('/admin/members', { replace: true }); }}>
          <Trash2 /> Delete member
        </ConfirmButton>
      </section>
        </>
      )}

      {tab === 'membership' && <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Membership" action={<Link to={`/admin/payments/new?member=${m.id}`} className="text-xs font-semibold text-brand-400 hover:underline">Renew membership</Link>}>
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
                    <p className="text-xs text-ink-500">{r.startDate || r.endDate ? `${fmtDate(r.startDate) || '?'} – ${fmtDate(r.endDate) || '?'}` : 'Dates not recorded'}{r.source === 'legacy_excel' ? ` · from the old member sheet${r.legacy?.rows && r.legacy.rows.length > 1 ? ` (rows ${r.legacy.rows.join(', ')})` : r.legacy ? ` (row ${r.legacy.row})` : ''}` : ''}</p>
                    {r.originalPackageLabel && r.originalPackageLabel !== r.planLabel && <p className="text-xs text-ink-500">Sheet says “{r.originalPackageLabel}”{r.packageType === 'bonus' ? ` — ${r.baseMonths} months + ${r.bonusMonths} bonus` : ''}</p>}
                    {balanceText(r) && <p className="text-xs text-ink-500">Old sheet balance column: “{balanceText(r)}” (a note, not a due)</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>}

      {tab === 'pt' && <div className="grid gap-5 lg:grid-cols-2">
        <MemberPt m={m} pt={pt} trainers={trainers} startAdd={params.has('add')} onChange={() => ptPackagesOf(id).then(setPt)} onPay={(pkg) => setDrawer('payment', { type: 'pt', packageId: pkg })} />
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
      </div>}

      {tab === 'payments' && <div className="max-w-3xl">
        <Card title="Payments" action={<Link to={`/admin/payments/new?member=${m.id}`} className="text-xs font-semibold text-brand-400 hover:underline">Record membership payment</Link>}>
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
      </div>}

      {tab === 'attendance' && (
        <section aria-label="Attendance" className="space-y-5">
          <div className="grid grid-cols-3 gap-2 text-center sm:max-w-md">
            {[['Today', inPeriod(periods.today)], ['This week', inPeriod(periods.week)], ['This month', inPeriod(periods.month)]].map(([k, v]) => (
              <div key={k as string} className="rounded-xl border border-white/[0.08] bg-ink-900 p-3"><p className="font-display text-3xl font-bold tabular-nums text-white">{history ? v : '…'}</p><p className="text-xs text-ink-400">{k}</p></div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-400">{visits ? <>{visits.length} visit{visits.length === 1 ? '' : 's'} in total{visits[0] && <> · last <span className="text-white">{fmtWhen(visits[0].at)}</span></>}</> : 'Loading…'}</p>
            <div className="flex gap-1 rounded-xl border border-white/[0.08] bg-ink-900 p-1" role="group" aria-label="Show">
              {([['all', 'All'], ['biometric', 'Biometric'], ['manual', 'Manual']] as const).map(([k, l]) => (
                <button key={k} type="button" aria-pressed={visitFilter === k} onClick={() => setVisitFilter(k)} className={cn('rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors', visitFilter === k ? 'bg-white text-ink-950' : 'text-ink-300 hover:text-white')}>{l}</button>
              ))}
            </div>
          </div>
          {!history ? <SkeletonRows rows={4} /> : (() => {
            const shown = history.filter((v) => visitFilter === 'all' || v.kind === visitFilter);
            if (!shown.length) return <EmptyNote title="No visits" body={visitFilter === 'biometric' && !ACCESS_CONNECTED ? 'The fingerprint device isn’t connected to this system yet, so door scans don’t appear here.' : 'Check-ins will appear here as they happen.'}><Button size="sm" variant="outline" onClick={() => setDrawer('checkin')}><ClipboardCheck /> Check in member</Button></EmptyNote>;
            return (
              <ol className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.08] bg-ink-900" aria-label="Attendance history">
                {shown.slice(0, 100).map((v) => (
                  <li key={v.id} className="flex items-center gap-4 px-4 py-3 text-sm">
                    <span className={cn('h-2 w-2 flex-shrink-0 rounded-full', v.kind === 'biometric' ? (v.ok ? 'bg-brand-400' : 'bg-red-400') : 'bg-sky-300')} aria-hidden />
                    <span className={cn('min-w-0 flex-1 truncate', v.ok ? 'text-white' : 'text-red-200')}>{v.how}</span>
                    <span className="tabular-nums text-ink-400">{fmtWhen(v.at)}</span>
                  </li>
                ))}
              </ol>
            );
          })()}
          <p className="text-xs text-ink-500">Manual = checked in at the front desk (earlier self check-ins are kept as history). Biometric = the fingerprint device.</p>
        </section>
      )}

      {tab === 'access' && <MemberAccess m={m} identities={identities} startEnrol={params.has('enroll')} onChange={() => { reload(); identitiesOfMember(id).then(setIdentities); }} />}

      {tab === 'events' && <div className="max-w-3xl">
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
      </div>}

      {tab === 'activity' && (
        <section aria-label="Member activity" className="max-w-3xl rounded-2xl border border-white/[0.08] bg-ink-900 p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">Activity</h2>
          {log === null ? <div className="mt-4 h-16 animate-pulse rounded-xl bg-ink-800" /> : log.length === 0 ? <p className="mt-4 text-sm text-ink-400">No recorded activity yet.</p> : (
            <ol className="mt-3 divide-y divide-white/[0.06] text-sm">
              {log.map((a) => <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2"><span className="text-white">{a.action}</span><span className="text-xs text-ink-500">{fmtTime(a.at)} · {a.actorEmail}</span></li>)}
            </ol>
          )}
        </section>
      )}
      </div>

      <SideDrawer open={drawer === 'renew' || drawer === 'payment'} onOpenChange={(o) => !o && closeDrawer()}
        title={drawer === 'renew' ? 'Renew membership' : 'Collect payment'} description={`${m.name} · ${memberCode(m.id)}`}>
        {paid ? (
          <div role="status" className="text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-brand-400" aria-hidden />
            <p className="mt-3 font-display text-3xl font-bold uppercase text-white">{paid.amount} collected</p>
            <p className="mt-1 text-sm text-ink-300">{PAYMENT_LABEL[paid.type]} from {m.name} is saved, with a receipt.</p>
            <div className="mt-6 flex justify-center gap-2">
              <Button asChild><Link to={`/admin/payments/${paid.id}?new=1`}>View receipt</Link></Button>
              <Button variant="outline" onClick={closeDrawer}>Done</Button>
            </div>
          </div>
        ) : drawer && (
          <PaymentForm key={drawer} compact initial={{ memberId: m.id, type: drawerType ?? 'membership', packageId: drawerPackage }}
            onSaved={(pid, sum) => { setPaid({ id: pid, ...sum }); refresh(); }} onCancel={closeDrawer} />
        )}
      </SideDrawer>

      <SideDrawer open={drawer === 'pt'} onOpenChange={(o) => !o && closeDrawer()} title="Add PT package" description={`${m.name} · separate from the gym membership`}>
        <PtPackageForm m={m} trainers={trainers} onCancel={closeDrawer}
          onSaved={(pkg) => { refresh(); setDrawer('payment', { type: 'pt', packageId: pkg }); }} />
      </SideDrawer>

      <SideDrawer open={drawer === 'access'} onOpenChange={(o) => !o && closeDrawer()} title="Enroll access" description="Fingerprint on the gym’s biometric device">
        <EnrollWizard m={m} existing={identities ?? []} onDone={() => identitiesOfMember(id).then(setIdentities)} />
      </SideDrawer>

      <SideDrawer open={drawer === 'checkin'} onOpenChange={(o) => !o && closeDrawer()} title="Check in" description={m.name}>
        <StaffCheckIn framed={false} initialMemberId={m.id} onDone={loadDesk} />
      </SideDrawer>
    </AdminShell>
  );
};

export default MemberProfile;

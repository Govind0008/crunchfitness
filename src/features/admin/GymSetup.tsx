import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Check, Circle } from 'lucide-react';
import { collection, getCountFromServer, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cn } from '@/lib/utils';
import { GYM } from '@/lib/gym';
import { ACCESS_CONNECTED } from '@/lib/access';
import { METHOD_LABEL } from '@/lib/admin/payments';
import { AdminShell } from '@/features/events/admin/shared';

type State = 'done' | 'todo' | 'waiting';
interface Step { title: string; state: State; body: ReactNode; to?: { href: string; label: string } }

/**
 * Settings → Gym setup: where each part of running a gym is configured, and whether it's done —
 * read from the real records. Existing Crunch data is already set up; nothing here re-runs setup.
 */
const GymSetup = () => {
  const [counts, setCounts] = useState<{ admins: number; plans: number; trainers: number } | null>(null);
  useEffect(() => {
    Promise.all([
      getCountFromServer(query(collection(db, 'userRoles'), where('role', '==', 'admin'))),
      getCountFromServer(collection(db, 'plans')),
      getCountFromServer(collection(db, 'teamMembers')),
    ]).then(([a, p, t]) => setCounts({ admins: a.data().count, plans: p.data().count, trainers: t.data().count }))
      .catch(() => setCounts({ admins: 0, plans: 0, trainers: 0 }));
  }, []);

  const n = (v: number | undefined, one: string, many: string) => (v == null ? '…' : `${v} ${v === 1 ? one : many}`);
  const steps: Step[] = [
    { title: 'Gym details', state: GYM.name && GYM.phone && GYM.address.length ? 'done' : 'todo',
      body: <>{GYM.name} · {GYM.address.join(', ')} · {GYM.phone} · {GYM.email} · WhatsApp {GYM.whatsappNumber.replace(/^91/, '+91 ')} · {GYM.timezone.replace('_', ' ')}</> },
    { title: 'Admin users', state: counts ? (counts.admins > 0 ? 'done' : 'todo') : 'todo', body: n(counts?.admins, 'admin account', 'admin accounts'), to: { href: '/admin/settings', label: 'Staff access' } },
    { title: 'Membership plans', state: counts ? (counts.plans > 0 ? 'done' : 'todo') : 'todo', body: n(counts?.plans, 'plan on the website', 'plans on the website'), to: { href: '/admin/plans', label: 'Plans' } },
    { title: 'Trainers', state: counts ? (counts.trainers > 0 ? 'done' : 'todo') : 'todo', body: n(counts?.trainers, 'team profile', 'team profiles'), to: { href: '/admin/trainers', label: 'Trainers' } },
    { title: 'Payment settings', state: 'done',
      body: <>Receipts numbered {GYM.payments.receiptPrefix}0001 onwards · {GYM.payments.methods.map((m) => METHOD_LABEL[m]).join(', ')} · {GYM.payments.tax ? `GST ${GYM.payments.tax.gstin}` : 'No GST registration set up — receipts are payment receipts, not tax invoices'}</> },
    { title: 'Access control', state: ACCESS_CONNECTED ? 'done' : 'waiting',
      body: 'No door device connected. Membership already decides who is allowed in; the device will be connected once its make and model are confirmed.' },
    { title: 'Branding', state: GYM.logo ? 'done' : 'todo', body: <span className="inline-flex items-center gap-3"><img src={GYM.logo} alt={`${GYM.name} logo`} className="h-8 w-auto rounded bg-white p-1" /> Logo and colours from the website</span> },
  ];
  const done = steps.filter((s) => s.state === 'done').length;

  return (
    <AdminShell title="Gym setup" nav="settings" area="System" back={{ to: '/admin/settings', label: 'Settings' }}>
      <div className="-mt-4 mb-8 max-w-2xl">
        <p className="text-sm text-ink-400">Everything a gym needs before staff start using the system. {GYM.name} is already set up — this page shows where each part lives.</p>
        <div className="mt-5 flex items-center gap-4" aria-label={`${done} of ${steps.length} steps done`}>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-brand-400" style={{ width: `${(done / steps.length) * 100}%` }} /></div>
          <p className="text-sm tabular-nums text-white">{done} of {steps.length}</p>
        </div>
      </div>
      <ol className="max-w-3xl space-y-3">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-4 rounded-2xl border border-white/[0.08] bg-ink-900 p-5">
            <span className={cn('flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold', s.state === 'done' ? 'bg-brand-400 text-ink-950' : s.state === 'waiting' ? 'border border-amber-300/50 text-amber-200' : 'border border-white/20 text-ink-400')}>
              {s.state === 'done' ? <Check size={16} aria-hidden /> : s.state === 'waiting' ? <Circle size={10} aria-hidden /> : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold text-white">{i + 1}. {s.title}</h2>
                <span className={cn('text-xs font-semibold', s.state === 'done' ? 'text-brand-300' : s.state === 'waiting' ? 'text-amber-200' : 'text-ink-400')}>{s.state === 'done' ? 'Done' : s.state === 'waiting' ? 'Waiting on device details' : 'To do'}</span>
              </div>
              <p className="mt-1 break-words text-sm text-ink-400">{s.body}</p>
              {s.to && <Link to={s.to.href} className="mt-2 inline-block text-sm font-semibold text-brand-400 hover:underline">{s.to.label} →</Link>}
            </div>
          </li>
        ))}
        <li className="rounded-2xl border border-dashed border-white/15 p-5 text-sm text-ink-400">
          <h2 className="font-semibold text-white">8. Finish</h2>
          <p className="mt-1">{done === steps.length ? 'Everything is set up.' : `${steps.length - done} step${steps.length - done === 1 ? '' : 's'} left${steps.some((s) => s.state === 'waiting') ? ' (access control is waiting on the device details)' : ''}.`} Setting up another gym uses the same steps — see PRODUCTION_CONFIGURATION.md.</p>
        </li>
      </ol>
    </AdminShell>
  );
};

export default GymSetup;

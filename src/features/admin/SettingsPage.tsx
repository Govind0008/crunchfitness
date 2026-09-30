import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSettings, saveSettings } from '@/lib/admin/settings';
import { logAdmin } from '@/lib/admin/activity';
import { createMarketingLogin, listStaff, removeStaffAccess, type StaffAccount } from '@/lib/admin/staff';
import { AdminShell, ConfirmButton, Field, inputCls } from '@/features/events/admin/shared';
import { useActor } from '@/features/events/admin/actor';

const ROLE_LABEL: Record<StaffAccount['role'], string> = { admin: 'Admin — everything', marketing: 'Marketing — blog, events, offers, social' };

/** Staff with admin or marketing access, and adding marketing logins. */
const StaffAccess = () => {
  const actor = useActor();
  const [staff, setStaff] = useState<StaffAccount[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = () => listStaff().then(setStaff).catch(() => setStaff([]));
  useEffect(() => { load(); }, []);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.email.includes('@') || form.password.length < 8 || form.name.trim().length < 2) {
      setMsg({ ok: false, text: 'Add a name, an email and a password of at least 8 characters.' }); return;
    }
    setBusy(true); setMsg(null);
    try {
      await createMarketingLogin(form, actor);
      setMsg({ ok: true, text: `${form.email} can now sign in at /marketing/login.` });
      setForm({ name: '', email: '', password: '' }); setAdding(false); load();
    } catch (err) {
      const code = (err as { code?: string }).code ?? '';
      setMsg({ ok: false, text: code.includes('email-already-in-use') ? 'That email already has an account.' : code.includes('weak-password') ? 'Choose a stronger password.' : 'The login couldn’t be created. Please try again.' });
    } finally { setBusy(false); }
  };

  return (
    <section aria-labelledby="staff-h" className="rounded-2xl border border-white/[0.08] bg-ink-900 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="staff-h" className="font-semibold text-white">Staff access</h2>
        {!adding && <Button size="sm" variant="outline" onClick={() => { setAdding(true); setMsg(null); }}><UserPlus /> Add marketing login</Button>}
      </div>
      <p className="mt-1 text-sm text-ink-400">Marketing logins use the Creative Desk (<code className="text-ink-200">/marketing/login</code>). They can’t see members, phone numbers, payments or check-ins. Trainer logins are under Trainers.</p>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={msg.ok ? 'mt-3 text-sm text-brand-fg' : 'mt-3 text-sm text-red-300'}>{msg.text}</p>}
      {adding && (
        <form onSubmit={add} className="mt-4 grid gap-3 rounded-xl border border-white/10 p-4 sm:grid-cols-3" noValidate>
          <Field label="Name" htmlFor="st-name"><input id="st-name" className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Email" htmlFor="st-email"><input id="st-email" type="email" autoComplete="off" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Password" hint="At least 8 characters — share it privately" htmlFor="st-pw"><input id="st-pw" type="password" autoComplete="new-password" className={inputCls} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
          <div className="flex gap-2 sm:col-span-3">
            <Button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create marketing login'}</Button>
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </form>
      )}
      {!staff ? <div className="mt-4 h-16 animate-pulse rounded-xl bg-ink-800" /> : (
        <ul className="mt-4 divide-y divide-white/[0.06]" aria-label="Staff accounts">
          {staff.map((s) => (
            <li key={s.uid} className="flex flex-wrap items-center gap-3 py-3 text-sm">
              <span className="min-w-0 flex-1"><span className="block truncate text-white">{s.name || s.email || 'Staff account'}</span><span className="text-xs text-ink-500">{s.email}{s.uid === actor.uid ? ' · you' : ''}</span></span>
              <span className="text-xs text-ink-300">{ROLE_LABEL[s.role]}</span>
              {s.role === 'marketing' && (
                <ConfirmButton size="sm" variant="secondary" confirm={{ title: `Remove ${s.email ?? 'this account'}?`, body: 'They will no longer be able to open the Creative Desk. You can add them again later.' }}
                  onConfirm={async () => { await removeStaffAccess(s, actor); load(); }}>Remove access</ConfirmButton>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

/** Settings — deliberately small. */
const SettingsPage = () => {
  const actor = useActor();
  const [days, setDays] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => { getSettings().then((s) => setDays(s.expiringSoonDays)); }, []);
  const save = async () => {
    if (days == null || days < 1 || days > 90) return;
    await saveSettings({ expiringSoonDays: days });
    await logAdmin(actor, 'Settings changed', 'settings', 'admin', { expiringSoonDays: days });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };
  const Tile = ({ to, title, sub }: { to: string; title: string; sub: string }) => (
    <Link to={to} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-ink-900 p-4 transition-colors hover:border-white/20">
      <span><span className="block font-semibold text-white">{title}</span><span className="text-sm text-ink-400">{sub}</span></span>
      <ArrowRight className="h-4 w-4 flex-shrink-0 text-ink-500" aria-hidden />
    </Link>
  );
  const Group = ({ title, children }: { title: string; children: ReactNode }) => (
    <section aria-label={title} className="space-y-3">
      <h2 className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-ink-400">{title}</h2>
      {children}
    </section>
  );
  return (
    <AdminShell title="Settings" nav="settings" area="More">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
        <div className="space-y-10">
          <Group title="Gym">
            <Tile to="/admin/settings/setup" title="Gym profile & setup" sub="Details, branding, payments and setup progress" />
            <Tile to="/admin/plans" title="Membership plans" sub="Plans and prices shown on the website" />
            <div className="space-y-4 rounded-xl border border-white/[0.08] bg-ink-900 p-4">
              <Field label="“Expiring soon” window" hint="Members whose membership ends within this many days are flagged on the dashboard and in Dues." htmlFor="exp-days">
                <input id="exp-days" type="number" min={1} max={90} className={inputCls} value={days ?? ''} onChange={(e) => setDays(Number(e.target.value))} />
              </Field>
              <Button onClick={save} disabled={days == null || days < 1 || days > 90}>{saved ? 'Saved' : 'Save'}</Button>
            </div>
          </Group>
          <Group title="Access control">
            <Tile to="/admin/settings/access" title="Devices" sub="Fingerprint devices, their status and enrolled users" />
          </Group>
          <Group title="System">
            <Tile to="/admin/activity" title="Activity log" sub="Who changed what, and when" />
            <Tile to="/admin/reports" title="Reports" sub="Spreadsheet downloads of members, payments and dues" />
          </Group>
        </div>
        <Group title="Users & roles">
          <StaffAccess />
          <Tile to="/admin/trainers" title="Trainer logins" sub="Portal accounts, managed on each trainer" />
        </Group>
      </div>
    </AdminShell>
  );
};

export default SettingsPage;

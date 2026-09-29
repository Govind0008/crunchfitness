import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Radio, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ACCESS_CONNECTED, HEALTH_LABEL, PROTOCOL_LABEL, deviceHealth, type AccessDevice, type DeviceProtocol } from '@/lib/access';
import { deviceCounts, listDevices, saveDevice, setDeviceEnabled, validateDevice, type DeviceInput } from '@/lib/access/store';
import { Link } from 'react-router-dom';
import { GYM } from '@/lib/gym';
import { AdminShell, ConfirmButton, Empty, Field, inputCls } from '@/features/events/admin/shared';
import { useActor } from '@/features/events/admin/actor';
import { fmtTime } from '@/features/admin/members/lookups';

const blank: DeviceInput = { name: '', model: 'eSSL X2008', serialNumber: '', location: '', protocol: 'sdk' };
const healthTone = (h: ReturnType<typeof deviceHealth>) => (h === 'online' ? 'bg-brand-400/15 text-brand-300' : h === 'offline' ? 'bg-red-500/15 text-red-200' : 'bg-white/[0.06] text-ink-300');

/**
 * Settings → Access control → Devices. Staff record which devices exist; whether a device is
 * online, its firmware and last sync are written only by the integration service when it
 * actually hears from the device — until then each device says "Waiting for first contact".
 */
const DevicesPage = () => {
  const actor = useActor();
  const [devices, setDevices] = useState<AccessDevice[] | null>(null);
  const [editing, setEditing] = useState<AccessDevice | 'new' | null>(null);
  const [f, setF] = useState<DeviceInput>(blank);
  const [errors, setErrors] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [counts, setCounts] = useState<Map<string, { enrolled: number; pending: number; errors: number }>>(new Map());
  const load = () => listDevices().then((d) => {
    setDevices(d);
    Promise.all(d.map((x) => deviceCounts(x.id).then((c) => [x.id, c] as const).catch(() => [x.id, { enrolled: 0, pending: 0, errors: 0 }] as const))).then((all) => setCounts(new Map(all)));
  }).catch((e) => { setDevices([]); setErrors([`Couldn’t load devices: ${e.message}`]); });
  useEffect(() => { load(); }, []);

  const open = (d: AccessDevice | 'new') => { setEditing(d); setErrors([]); setF(d === 'new' ? blank : { name: d.name, model: d.model, serialNumber: d.serialNumber, location: d.location, protocol: d.protocol }); };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validateDevice(f); setErrors(errs);
    if (errs.length) return;
    try { await saveDevice(f, actor, editing === 'new' ? undefined : editing ?? undefined); setEditing(null); load(); }
    catch (err) { setErrors([`Couldn’t save: ${(err as Error).message}`]); }
  };
  // The reader on the gym PC reports in every minute: "test" = look at when it last did
  const test = async (d: AccessDevice) => {
    const fresh = (await listDevices()).find((x) => x.id === d.id) ?? d;
    setDevices((all) => all?.map((x) => (x.id === d.id ? fresh : x)) ?? all);
    const h = deviceHealth(fresh);
    const ago = fresh.lastSeenAt ? Math.round((Date.now() - fresh.lastSeenAt.toDate().getTime()) / 1000) : null;
    setNote(h === 'online' ? `${fresh.name} is online — it reported in ${ago! < 90 ? `${ago} seconds` : `${Math.round(ago! / 60)} minutes`} ago`
      : h === 'never_connected' ? `${fresh.name} hasn’t reported in yet. Check its Cloud Server Setting points to this CRM`
      : h === 'disabled' ? `${fresh.name} is disabled here`
      : `${fresh.name} is offline — last heard ${fresh.lastSeenAt ? fmtTime(fresh.lastSeenAt as never) : 'never'}. Check the device has power and internet${fresh.lastError ? ` (${fresh.lastError})` : ''}`);
  };

  return (
    <AdminShell title="Access devices" nav="settings" area="Settings" back={{ to: '/admin/settings', label: 'Settings' }}
      actions={editing ? undefined : <Button onClick={() => open('new')}><Plus /> Add device</Button>}>
      <p className="-mt-4 mb-6 max-w-2xl text-sm text-ink-400">The biometric devices at {GYM.name}. Adding a device here doesn’t change anything on the device itself.</p>
      <div role="status" className="mb-6 max-w-3xl rounded-xl border border-white/[0.08] bg-ink-900 p-4 text-sm text-ink-300">
        <p className="font-semibold text-white">How devices connect</p>
        <p className="mt-1">Each device sends its scans over the internet to this CRM (Menu → Comm. → Cloud Server Setting on the device). Everything is passed on unchanged to the old attendance server, so the old system keeps working. The CRM records scans of linked members, keeps the device’s user list for matching, and can add new members to the device. A device shows “Online” only when it has actually reported in.</p>
      </div>
      {note && <p role="status" className="mb-4 text-sm text-ink-200">{note}.</p>}

      {editing && (
        <form onSubmit={save} className="mb-8 grid max-w-3xl gap-4 rounded-2xl border border-white/[0.08] bg-ink-900 p-5 sm:grid-cols-2" noValidate aria-label={editing === 'new' ? 'New device' : 'Edit device'}>
          {errors.length > 0 && <div role="alert" className="text-sm text-red-300 sm:col-span-2">{errors.map((x) => <p key={x}>{x}</p>)}</div>}
          <Field label="Name" hint="Where it is, e.g. Main entrance" htmlFor="dv-name"><input id="dv-name" className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Model" htmlFor="dv-model"><input id="dv-model" className={inputCls} value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} /></Field>
          <Field label="Serial number" hint="On the device: Menu → System info" htmlFor="dv-serial"><input id="dv-serial" className={inputCls} value={f.serialNumber} onChange={(e) => setF({ ...f, serialNumber: e.target.value })} /></Field>
          <Field label="Location" hint="Optional" htmlFor="dv-loc"><input id="dv-loc" className={inputCls} value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></Field>
          <Field label="Protocol" hint="How it will talk to the CRM" htmlFor="dv-proto">
            <select id="dv-proto" className={inputCls} value={f.protocol} onChange={(e) => setF({ ...f, protocol: e.target.value as DeviceProtocol })}>
              {(Object.keys(PROTOCOL_LABEL) as DeviceProtocol[]).map((p) => <option key={p} value={p}>{PROTOCOL_LABEL[p]}</option>)}
            </select>
          </Field>
          <p className="self-end text-xs text-ink-500">Server addresses and device passwords are set on the integration service, never here.</p>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit">{editing === 'new' ? 'Add device' : 'Save'}</Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </form>
      )}

      {!devices ? <div className="h-24 animate-pulse rounded-2xl bg-ink-900" role="status" aria-label="Loading devices" /> : devices.length === 0 ? (
        <Empty title="No devices yet" body="Add the gym’s fingerprint device (serial number from Menu → System Info) so the access reader can report it." />
      ) : (
        <ul className="space-y-3" aria-label="Devices">
          {devices.map((d) => {
            const h = deviceHealth(d);
            return (
              <li key={d.id} className="rounded-2xl border border-white/[0.08] bg-ink-900 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-2xl font-bold uppercase text-white">{d.name}</p>
                    <p className="text-sm text-ink-400">{d.model}{d.serialNumber ? ` · Serial ${d.serialNumber}` : ' · serial not recorded'}{d.location ? ` · ${d.location}` : ''}</p>
                  </div>
                  {/* Never a green status until a real integration reports the device */}
                  <span className={cn('rounded-full px-3 py-1 text-xs font-bold', ACCESS_CONNECTED ? healthTone(h) : 'bg-amber-400/15 text-amber-100')}>{ACCESS_CONNECTED ? HEALTH_LABEL[h] : h === 'disabled' ? 'Disabled' : 'Integration not configured'}</span>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
                  <div><dt className="text-xs text-ink-500">Protocol</dt><dd className="text-white">{PROTOCOL_LABEL[d.protocol]}</dd></div>
                  <div><dt className="text-xs text-ink-500">Last communication</dt><dd className="text-white">{d.lastSeenAt ? fmtTime(d.lastSeenAt as never) : 'Never'}</dd></div>
                  <div><dt className="text-xs text-ink-500">Last sync</dt><dd className="text-white">{d.lastSyncAt ? fmtTime(d.lastSyncAt as never) : 'Never'}</dd></div>
                  <div><dt className="text-xs text-ink-500">Firmware</dt><dd className="text-white">{d.firmware ?? 'Unknown until it connects'}</dd></div>
                  <div><dt className="text-xs text-ink-500">Enrolled users</dt><dd className="text-white">{counts.get(d.id)?.enrolled ?? '…'}</dd></div>
                  <div><dt className="text-xs text-ink-500">Pending</dt><dd className="text-white">{counts.get(d.id)?.pending ?? '…'}</dd></div>
                  <div><dt className="text-xs text-ink-500">Errors</dt><dd className={(counts.get(d.id)?.errors ?? 0) ? 'text-red-200' : 'text-white'}>{counts.get(d.id)?.errors ?? '…'}</dd></div>
                </dl>
                {d.lastError && <p className="mt-2 text-sm text-red-200">Last error: {d.lastError}</p>}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => open(d)}>Configure</Button>
                  <Button size="sm" variant="outline" onClick={() => test(d)}><Radio /> Test connection</Button>
                  <Button asChild size="sm"><Link to={`/admin/settings/access/${d.id}/users`}><Users /> Match users</Link></Button>
                  <Button asChild size="sm" variant="ghost"><Link to="/admin/access">View events</Link></Button>
                  <ConfirmButton size="sm" variant="secondary" confirm={{ title: d.enabled ? `Disable ${d.name}?` : `Enable ${d.name}?`, body: d.enabled ? 'It won’t be offered for new enrolments. Nothing changes on the device itself.' : 'It will be offered for enrolments again.' }}
                    onConfirm={async () => { await setDeviceEnabled(d, !d.enabled, actor); load(); }}>{d.enabled ? 'Disable' : 'Enable'}</ConfirmButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </AdminShell>
  );
};

export default DevicesPage;

import { useCallback, useEffect, useState } from 'react';
import { Activity, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { auth } from '@/lib/firebase-auth';
import { fmtTime } from '@/features/admin/members/lookups';
import { Pill, type Tone } from '../kit';

// What the server has actually received from devices (the ADMS relay at /iclock/*). Nothing is
// inferred: a device is "connected" only after a real request from its serial number.

interface Contact {
  sn: string; probe: boolean; crmDeviceId: string | null; lastSeenAt: string | null; firstSeenAt: string | null;
  last: { kind: string; path: string; method: string; table: string; status: number; upstreamStatus: number | null; durationMs: number; note?: string } | null;
  counts: Record<string, number>; userAgent: string; remoteIp: string; pushVersion: string;
  state: 'connected' | 'seen earlier' | 'unregistered serial' | 'self-test';
}
interface Status {
  service: { alive: boolean; time: string; region: string; firestore: boolean; firestoreProblem: string | null; upstreamConfigured: boolean };
  devices: { id: string; name: string; serialNumber: string; lastSeenAt: string | null }[];
  contacts: Contact[]; connectedWindowMinutes?: number;
}
interface SelfTest { ok: boolean; steps: { step: string; ok: boolean; detail: string; ms?: number }[]; testedHost: string; at: string }

const STATE_TONE: Record<Contact['state'], Tone> = { connected: 'ok', 'seen earlier': 'warn', 'unregistered serial': 'bad', 'self-test': 'muted' };
const when = (iso: string | null) => (iso ? fmtTime({ toDate: () => new Date(iso) } as never) : 'never');

async function call<T>(check: string, method = 'GET'): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  const r = await fetch(`/api/adms?check=${check}`, { method, headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!r.ok) {
    const detail = await r.json().then((j: { error?: string }) => j.error).catch(() => '');
    throw new Error(r.status === 401 ? 'Only admins can see device diagnostics.' : r.status === 404 ? 'The diagnostics service isn’t deployed yet.' : detail || `HTTP ${r.status}`);
  }
  return r.json() as Promise<T>;
}

const ConnectionDiagnostics = () => {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [test, setTest] = useState<SelfTest | null>(null);
  const [testing, setTesting] = useState(false);
  const load = useCallback(() => { setError(null); call<Status>('status').then(setStatus).catch((e: Error) => setError(e.message)); }, []);
  useEffect(() => { load(); }, [load]);
  const runTest = async () => {
    setTesting(true); setTest(null);
    try { setTest(await call<SelfTest>('selftest', 'POST')); load(); }
    catch (e) { setTest({ ok: false, steps: [{ step: 'Self-test', ok: false, detail: (e as Error).message }], testedHost: '', at: new Date().toISOString() }); }
    finally { setTesting(false); }
  };
  const real = status?.contacts.filter((c) => !c.probe) ?? [];
  const serials = new Set(status?.devices.map((d) => d.serialNumber.toUpperCase()) ?? []);

  return (
    <section aria-labelledby="diag-h" className="mb-8 max-w-4xl rounded-2xl border border-white/[0.08] bg-ink-900 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="diag-h" className="flex items-center gap-2 font-sans text-sm font-bold uppercase tracking-wider text-white"><Activity className="h-4 w-4 text-brand-400" aria-hidden /> Connection diagnostics</h2>
          <p className="mt-1 text-sm text-ink-400">What the server has actually received from devices. A device is “connected” only after a real request from its serial number{status?.connectedWindowMinutes ? ` in the last ${status.connectedWindowMinutes} minutes` : ''}.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={load}><RefreshCw /> Refresh</Button>
          <Button size="sm" onClick={runTest} disabled={testing}><ShieldCheck /> {testing ? 'Testing…' : 'Run server self-test'}</Button>
        </div>
      </div>

      {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
      {status && (
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <div><dt className="text-xs text-ink-500">Relay service</dt><dd className="text-white">{status.service.alive ? `Alive (${status.service.region})` : 'Down'}</dd></div>
          <div><dt className="text-xs text-ink-500">Recording to CRM</dt><dd className={status.service.firestore ? 'text-white' : 'text-red-200'}>{status.service.firestore ? 'Working' : status.service.firestoreProblem ?? 'Not configured'}</dd></div>
          <div><dt className="text-xs text-ink-500">Old server relay</dt><dd className="text-white">{status.service.upstreamConfigured ? 'On — everything is passed on' : 'Off'}</dd></div>
          <div><dt className="text-xs text-ink-500">Devices heard from</dt><dd className="text-white">{real.length}</dd></div>
        </dl>
      )}

      {status && (real.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-white/15 p-4 text-sm text-ink-300" role="status">No request from any device has reached the server yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-white/[0.06] rounded-xl border border-white/[0.08]" aria-label="Device contacts">
          {real.map((c) => (
            <li key={c.sn} className="space-y-1 p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-white">SN {c.sn || '(none)'}</span>
                <Pill tone={STATE_TONE[c.state]}>{c.state === 'connected' ? 'Connected' : c.state === 'seen earlier' ? 'Seen earlier' : 'Serial not in the CRM'}</Pill>
                <span className="text-ink-400">last contact {when(c.lastSeenAt)}</span>
              </div>
              {c.last && <p className="text-ink-300">Last request: <span className="text-white">{c.last.kind}</span> ({c.last.method} /iclock/{c.last.path}{c.last.table ? `?table=${c.last.table}` : ''}) → answered {c.last.status}{c.last.upstreamStatus != null ? `, old server ${c.last.upstreamStatus}` : ''} in {c.last.durationMs} ms{c.last.note ? ` · ${c.last.note}` : ''}</p>}
              <p className="text-xs text-ink-500">{Object.entries(c.counts).map(([k, n]) => `${k}: ${n}`).join(' · ')}{c.pushVersion ? ` · push ${c.pushVersion}` : ''}{c.userAgent ? ` · ${c.userAgent}` : ''}</p>
              {c.state === 'unregistered serial' && <p className="text-xs text-amber-200">No device in the CRM has serial {c.sn}. {status.devices.length ? `Registered: ${[...serials].join(', ')}.` : ''} Check the serial on the device (Menu → System Info → Device Info) against the CRM device.</p>}
            </li>
          ))}
        </ul>
      ))}

      {test && (
        <div className="mt-4 rounded-xl border border-white/[0.08] p-4" role="status" aria-label="Self-test result">
          <p className={cn('text-sm font-semibold', test.ok ? 'text-brand-300' : 'text-red-200')}>{test.ok ? 'Server side is ready for the device' : 'Something on the server side needs attention'}{test.testedHost ? ` · ${test.testedHost}` : ''}</p>
          <ol className="mt-2 space-y-1 text-sm">
            {test.steps.map((s) => <li key={s.step} className="flex gap-2"><span className={s.ok ? 'text-brand-400' : 'text-red-300'} aria-hidden>{s.ok ? '✓' : '✗'}</span><span className="text-white">{s.step}</span><span className="text-ink-400">— {s.detail}{s.ms != null ? ` (${s.ms} ms)` : ''}</span></li>)}
          </ol>
          <p className="mt-2 text-xs text-ink-500">The self-test uses a reserved test serial: it is never sent to the old server and changes nothing.</p>
        </div>
      )}
    </section>
  );
};

export default ConnectionDiagnostics;

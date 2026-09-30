import { lookup } from 'node:dns/promises';
import { connect } from 'node:net';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Timestamp } from 'firebase-admin/firestore';
import { adminProblem, firestoreOrNull, requireAdmin } from './_lib/firebase.js';
import { PROBE_SN } from './_lib/diagnostics.js';

// Diagnostics for the device connection (the ADMS relay at /iclock/*). Read-only: nothing here
// sends anything to a device or to the old attendance server's /iclock endpoints.
//
//   GET  /api/adms?check=health     public: is the service alive and configured (no data)
//   GET  /api/adms?check=status     admins: every serial that has contacted us, and when
//   POST /api/adms?check=selftest   admins: DNS, HTTPS, /iclock route and reply format, checked
//                                   from the server using the reserved self-test serial

const GYM = 'crunch-wakad';
const UPSTREAM = (process.env.ADMS_UPSTREAM ?? 'http://122.160.158.120:5072').replace(/\/$/, '');
/** "Connected" means a real request from that serial within this window — never assumed. */
const CONNECTED_WINDOW_MS = 10 * 60 * 1000;

const iso = (v: unknown) => (v instanceof Timestamp ? v.toDate().toISOString() : typeof v === 'string' ? v : null);

function upstreamHostPort() {
  if (UPSTREAM === 'none' || !UPSTREAM) return null;
  const u = new URL(UPSTREAM);
  return { host: u.hostname, port: Number(u.port || (u.protocol === 'https:' ? 443 : 80)) };
}

/** Can we open a TCP connection to the old server? (No HTTP request is sent.) */
function tcpReachable(host: string, port: number, ms = 4000): Promise<{ ok: boolean; ms: number; error?: string }> {
  const t0 = Date.now();
  return new Promise((resolve) => {
    const sock = connect({ host, port });
    const done = (ok: boolean, error?: string) => { sock.destroy(); resolve({ ok, ms: Date.now() - t0, ...(error ? { error } : {}) }); };
    sock.setTimeout(ms, () => done(false, 'timed out'));
    sock.once('connect', () => done(true));
    sock.once('error', (e) => done(false, e.message));
  });
}

async function status() {
  const fs = firestoreOrNull();
  const service = { alive: true, time: new Date().toISOString(), region: process.env.VERCEL_REGION ?? 'local', firestore: !!fs, firestoreProblem: adminProblem() || null, upstreamConfigured: !!upstreamHostPort() };
  if (!fs) return { service, devices: [], contacts: [] };
  const [devSnap, diagSnap] = await Promise.all([
    fs.collection('gyms').doc(GYM).collection('devices').get(),
    fs.collection('admsDiagnostics').orderBy('lastSeenAt', 'desc').limit(20).get(),
  ]);
  const devices = devSnap.docs.map((d) => ({ id: d.id, name: d.get('name') ?? '', serialNumber: d.get('serialNumber') ?? '', lastSeenAt: iso(d.get('lastSeenAt')), connection: d.get('connection') ?? null }));
  const serials = new Map(devices.map((d) => [String(d.serialNumber).toUpperCase(), d.id]));
  const now = Date.now();
  const contacts = diagSnap.docs.map((d) => {
    const lastSeenAt = iso(d.get('lastSeenAt'));
    const sn = String(d.get('sn') ?? '');
    const crmDeviceId = serials.get(sn.toUpperCase()) ?? null;
    const recentMs = lastSeenAt ? now - new Date(lastSeenAt).getTime() : Infinity;
    const probe = !!d.get('probe');
    return {
      sn, probe, crmDeviceId, lastSeenAt, firstSeenAt: iso(d.get('firstSeenAt')), last: d.get('last') ?? null, counts: d.get('counts') ?? {},
      userAgent: d.get('lastUserAgent') ?? '', remoteIp: d.get('lastRemoteIp') ?? '', pushVersion: d.get('pushVersion') ?? '', recent: (d.get('recent') as unknown[] ?? []).slice(0, 10),
      // Only a real device request, from a serial registered in the CRM, recently, counts as connected
      state: probe ? 'self-test' : !crmDeviceId ? 'unregistered serial' : recentMs <= CONNECTED_WINDOW_MS ? 'connected' : 'seen earlier',
    };
  });
  return { service, devices, contacts, connectedWindowMinutes: CONNECTED_WINDOW_MS / 60000 };
}

async function selftest(host: string) {
  const steps: { step: string; ok: boolean; detail: string; ms?: number }[] = [];
  const time = async (step: string, fn: () => Promise<string>) => {
    const t0 = Date.now();
    try { steps.push({ step, ok: true, detail: await fn(), ms: Date.now() - t0 }); }
    catch (e) { steps.push({ step, ok: false, detail: (e as Error).message, ms: Date.now() - t0 }); }
  };
  const base = host.startsWith('http') ? host : `https://${host}`;
  const name = new URL(base).hostname;
  await time('DNS', async () => { const a = await lookup(name, { all: true }); if (!a.length) throw new Error('no addresses'); return `${name} → ${a.map((x) => x.address).join(', ')}`; });
  await time('HTTPS and /iclock route (handshake)', async () => {
    const r = await fetch(`${base}/iclock/cdata?SN=${PROBE_SN}&options=all&pushver=selftest`, { signal: AbortSignal.timeout(10_000) });
    const text = await r.text();
    if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
    if (!text.startsWith(`GET OPTION FROM: ${PROBE_SN}`)) throw new Error(`unexpected reply: ${text.slice(0, 80)}`);
    return `HTTP 200, ADMS handshake format OK (${text.split('\n').length} option lines)`;
  });
  await time('Command poll (getrequest)', async () => {
    const r = await fetch(`${base}/iclock/getrequest?SN=${PROBE_SN}`, { signal: AbortSignal.timeout(10_000) });
    const text = (await r.text()).trim();
    if (r.status !== 200 || text !== 'OK') throw new Error(`HTTP ${r.status}: ${text.slice(0, 80)}`);
    return 'HTTP 200 "OK"';
  });
  await time('Recording (Firestore)', async () => {
    const fs = firestoreOrNull();
    if (!fs) throw new Error(adminProblem() || 'not configured');
    const d = await fs.collection('admsDiagnostics').doc(PROBE_SN).get();
    if (!d.exists) throw new Error('the self-test request was not recorded');
    return `self-test contact recorded at ${iso(d.get('lastSeenAt'))}`;
  });
  const up = upstreamHostPort();
  await time('Old attendance server reachable (TCP only)', async () => {
    if (!up) return 'no old server configured (relay answers by itself)';
    const r = await tcpReachable(up.host, up.port);
    if (!r.ok) throw new Error(`${up.host}:${up.port} — ${r.error}`);
    return `${up.host}:${up.port} accepts connections (${r.ms} ms)`;
  });
  return { ok: steps.every((s) => s.ok), steps, testedHost: name, at: new Date().toISOString() };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const check = String(req.query.check ?? 'health');
  if (check === 'health') {
    const recording = !!firestoreOrNull();
    res.status(200).json({ alive: true, service: 'adms-relay', time: new Date().toISOString(), region: process.env.VERCEL_REGION ?? 'local', recording, ...(recording ? {} : { recordingProblem: adminProblem() }), upstreamConfigured: !!upstreamHostPort() });
    return;
  }
  // Without the key we can't even check who is asking — say so plainly
  if (!firestoreOrNull()) { res.status(503).json({ error: `Recording isn't set up: ${adminProblem()}` }); return; }
  const who = await requireAdmin(req.headers.authorization);
  if (!who) { res.status(401).json({ error: 'Sign in as an admin' }); return; }
  if (check === 'status' && req.method === 'GET') { res.status(200).json(await status()); return; }
  if (check === 'selftest' && req.method === 'POST') {
    const proto = String(req.headers['x-forwarded-proto'] ?? 'https').split(',')[0];
    const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? '');
    res.status(200).json(await selftest(`${proto}://${host}`));
    return;
  }
  res.status(400).json({ error: 'Unknown check' });
}

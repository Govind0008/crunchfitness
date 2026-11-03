import { test, expect } from '@playwright/test';
import http from 'node:http';
import { PassThrough } from 'node:stream';
import type { AddressInfo } from 'node:net';
import { ADMIN, AUTH, FS, PROJECT, resetFirestore, seedAdmin, seedDoc, ts } from './emulator';

// The ADMS relay (api/iclock.ts) between the fingerprint device and the old attendance server.
// A fake "old server" records exactly what it receives; the relay runs against the emulator.
// Named *-rules so it runs once (desktop project only).
test.describe.configure({ mode: 'serial' });
test.skip(({ isMobile }) => isMobile, 'server test runs once');

const SN = 'JJA1254700696';
let upstream: http.Server;
let relay: http.Server;
let relayUrl = '';
let upstreamDown = false;
let upstreamMaxBody = Infinity;
let upstreamPoll: string | null = null;   // what the old server answers a command poll (default C:77:INFO)   // like the real old server on 27 Oct 2026: drops an upload bigger than this
const received: { method: string; url: string; body: string }[] = [];

const docUrl = (path: string) => `${FS}/v1/projects/${PROJECT}/databases/(default)/documents/${path}`;
async function getDoc(path: string) {
  const r = await fetch(docUrl(path), { headers: { Authorization: 'Bearer owner' } });
  return r.ok ? ((await r.json()) as { fields: Record<string, { stringValue?: string; integerValue?: string }> }).fields : null;
}
async function list(path: string) {
  const r = await fetch(docUrl(path), { headers: { Authorization: 'Bearer owner' } });
  return ((await r.json()) as { documents?: { name: string; fields: Record<string, { stringValue?: string }> }[] }).documents ?? [];
}
const send = (path: string, method = 'GET', body?: string) => fetch(`${relayUrl}/iclock/${path}`, { method, body, headers: body ? { 'Content-Type': 'text/plain' } : undefined });

test.beforeAll(async () => {
  await resetFirestore();
  // The old server: a fake that answers like an ADMS server and remembers every request
  upstream = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      if (upstreamDown || body.length > upstreamMaxBody) { req.socket.destroy(); return; }
      received.push({ method: req.method!, url: req.url!, body });
      const u = new URL(req.url!, 'http://x');
      u.pathname = u.pathname.replace(/\.aspx$/, '');   // real ADMS servers answer both forms
      res.setHeader('Content-Type', 'text/plain');
      if (u.pathname === '/iclock/cdata' && req.method === 'GET') res.end(`GET OPTION FROM: ${u.searchParams.get('SN')}\nATTLOGStamp=12345\nDelay=10`);
      else if (u.pathname === '/iclock/cdata') res.end(`OK: ${body.split('\n').filter(Boolean).length}`);
      else if (u.pathname === '/iclock/getrequest') res.end(upstreamPoll ?? 'C:77:INFO');
      else res.end('OK');
    });
  }).listen(0);
  await new Promise((r) => upstream.once('listening', r));
  process.env.ADMS_UPSTREAM = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  process.env.GCLOUD_PROJECT = PROJECT;
  process.env.ADMS_COMMAND_CHECK_MS = '0';      // look for queued commands on every poll
  process.env.ADMS_ROUTINE_RECORD_MS = '0';     // record every poll's contact
  process.env.ADMS_HEARTBEAT_MS = '0';          // write the device's last contact every time
  process.env.ADMS_UPSTREAM_RETRY_MS = '0';      // a down old server is tried again on the very next request
  const { default: handler } = await import('../../api/iclock');
  const { default: diagnostics } = await import('../../api/adms');

  // A minimal Vercel-style wrapper around the handler
  relay = http.createServer((req, res) => {
    const url = new URL(req.url!, 'http://relay');
    const m = url.pathname.match(/^\/iclock\/(.*)$/);
    const query: Record<string, string> = Object.fromEntries(url.searchParams);
    if (m) { query.path = m[1]; url.searchParams.set('path', m[1]); }
    const vres = Object.assign(res, {
      status(code: number) { res.statusCode = code; return vres; },
      send(b: string | Buffer) { res.end(b); return vres; },
      json(o: unknown) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); return vres; },
    });
    if (url.pathname === '/api/adms') {
      Object.assign(req, { query, headers: { ...req.headers, 'x-forwarded-proto': 'http' } });
      diagnostics(req as never, vres as never).catch((e: Error) => { res.statusCode = 500; res.end(e.message); });
      return;
    }
    Object.assign(req, { query, url: `/api/iclock${url.search}` });
    // Like Vercel's Node runtime (@vercel/node addHelpers/restoreBody): read the whole body first,
    // then re-attach it only to 'data'/'end' listeners — the relay must still get every byte
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const replay = new PassThrough();
      const on = replay.on.bind(replay);
      const originalOn = req.on.bind(req);
      req.read = replay.read.bind(replay) as never;
      req.on = req.addListener = ((name: string, cb: (...a: unknown[]) => void) => (name === 'data' || name === 'end' ? on(name, cb) : originalOn(name, cb))) as never;
      replay.write(Buffer.concat(chunks));
      replay.end();
      handler(req as never, vres as never).catch((e: Error) => { res.statusCode = 500; res.end(e.message); });
    });
  }).listen(0);
  await new Promise((r) => relay.once('listening', r));
  relayUrl = `http://127.0.0.1:${(relay.address() as AddressInfo).port}`;

  await seedDoc('gyms/crunch-wakad/devices/dev1', { gymId: 'crunch-wakad', name: 'Main entrance', model: 'eSSL X2008', serialNumber: SN, protocol: 'adms', enabled: true, nextUserId: 1, lastSeenAt: null, lastSyncAt: null, firmware: null, lastError: null });
  await seedDoc('members/m1', { name: 'Asha Rao', phone: '9000000001', phoneKey: '9000000001', status: 'active', membershipEnd: '2099-12-31', activeUntil: '2099-12-31' });
  await seedDoc('members/m2', { name: 'Old Member', phone: '9000000002', phoneKey: '9000000002', status: 'active', membershipEnd: '2020-01-01', activeUntil: '2020-01-01' });
  // 501: created by the new CRM (it controls access). 502: an old-system user linked for attendance
  // only (no managedBy marker) — the new CRM must never judge or change them.
  await seedDoc('biometricIdentities/dev1_501', { gymId: 'crunch-wakad', memberId: 'm1', deviceId: 'dev1', deviceUserId: '501', method: 'fingerprint', status: 'PENDING', managedBy: 'crm', accessEnabled: true, enrollment: 'requested' });
  await seedDoc('biometricIdentities/dev1_502', { gymId: 'crunch-wakad', memberId: 'm2', deviceId: 'dev1', deviceUserId: '502', method: 'fingerprint', status: 'SYNCED' });
});
test.afterAll(() => { upstream?.close(); relay?.close(); });

test('the handshake and every scan reach the old server unchanged; its replies reach the device', async () => {
  const hs = await send(`cdata?SN=${SN}&options=all&pushver=2.4.1`);
  expect(await hs.text()).toContain('ATTLOGStamp=12345');                        // the old server's own options
  expect(received.at(-1)!.url).toBe(`/iclock/cdata?SN=${SN}&options=all&pushver=2.4.1`);

  const attlog = '501\t2026-09-29 18:05:10\t0\t1\t0\t0\n999\t2026-09-29 18:06:00\t0\t1\t0\t0\n502\t2026-09-29 18:07:00\t0\t4\t0\t0\n';
  const up = await send(`cdata?SN=${SN}&table=ATTLOG&Stamp=12346`, 'POST', attlog);
  expect(await up.text()).toBe('OK: 3');                                           // acknowledged by the OLD server
  expect(received.at(-1)!.body).toBe(attlog);                                      // byte for byte, all three lines
});

test('every punch is kept; only CRM-managed users are judged; old-system and unknown users are never denied', async () => {
  const events = await list('accessEvents');
  expect(events.map((e) => e.fields.deviceUserId.stringValue).sort()).toEqual(['501', '502', '999']);
  const unknown = events.find((e) => e.fields.deviceUserId.stringValue === '999')!.fields;
  expect(unknown.personType.stringValue).toBe('unknown');                         // kept, not matched to anyone
  expect(unknown.result.stringValue).toBe('unknown_user');
  expect(unknown.memberId).toEqual({ nullValue: null });
  const asha = events.find((e) => e.fields.deviceUserId.stringValue === '501')!.fields;
  expect(asha.result.stringValue).toBe('granted');
  expect(asha.decision.stringValue).toBe('ACCESS_ALLOWED');
  expect(asha.at.stringValue).toBe('2026-09-29T12:35:10.000Z');                  // 18:05:10 India time
  expect(asha.verify.stringValue).toBe('fingerprint');
  // 502's membership has expired, but the old system manages them: recorded, never "denied"
  const legacy = events.find((e) => e.fields.deviceUserId.stringValue === '502')!.fields;
  expect(legacy.result.stringValue).toBe('legacy');
  expect(legacy.decision.stringValue).toBe('LEGACY_USER');
  expect(legacy.decisionReason).toEqual({ nullValue: null });
  expect(unknown.decision.stringValue).toBe('UNKNOWN_USER');
  // …and nothing at all was queued for the device because of these scans
  expect(await list('gyms/crunch-wakad/devices/dev1/commands')).toEqual([]);
  // A scan verified BY FINGERPRINT is the device's own proof the fingerprint is enrolled
  expect((await getDoc('biometricIdentities/dev1_501'))!.enrollment.stringValue).toBe('confirmed');
  expect((await getDoc('biometricIdentities/dev1_501'))!.status.stringValue).toBe('SYNCED');   // the device knows this user
  const dev = await getDoc('gyms/crunch-wakad/devices/dev1');
  expect(dev!.connection.stringValue).toBe('relay');
});

test('the device’s user list is kept for matching (names only — fingerprints ignored)', async () => {
  const oplog = 'USER PIN=601\tName=RAVI K\tPri=0\tPasswd=\tCard=\tGrp=1\nFP PIN=601\tFID=6\tSize=1000\tValid=1\tTMP=AAAA\nUSER PIN=602\tName=Admin\tPri=14\n';
  await send(`cdata?SN=${SN}&table=OPERLOG&Stamp=5`, 'POST', oplog);
  expect(received.at(-1)!.body).toBe(oplog);                                       // the old server still gets everything
  const users = await list('gyms/crunch-wakad/devices/dev1/deviceUsers');
  expect(users.map((u) => u.fields.name.stringValue).sort()).toEqual(['Admin', 'RAVI K']);
  expect(JSON.stringify(users)).not.toContain('TMP');
});

test('CRM commands go to the device alongside the old server’s; results are routed back', async () => {
  await seedDoc('gyms/crunch-wakad/devices/dev1/commands/c1', { type: 'add_user', deviceUserId: '10061', name: 'Riya\tNew', status: 'queued', createdBy: 'x' });
  const poll = await (await send(`getrequest?SN=${SN}`)).text();
  expect(poll).toContain('C:77:INFO');                                             // the old server's command, kept
  const ours = poll.split('\n').find((l) => l.includes('USERINFO'))!;
  expect(ours).toMatch(/^C:9\d{8}:DATA UPDATE USERINFO PIN=10061\tName=Riya New\t/);
  const id = ours.split(':')[1];
  expect((await getDoc('gyms/crunch-wakad/devices/dev1/commands/c1'))!.status.stringValue).toBe('sent');

  const before = received.length;
  await send(`devicecmd?SN=${SN}`, 'POST', `ID=${id}&Return=0&CMD=DATA\nID=77&Return=0&CMD=INFO\n`);
  expect(received.length).toBe(before + 1);
  expect(received.at(-1)!.body).toBe('ID=77&Return=0&CMD=INFO\n');               // only theirs goes to the old server
  expect((await getDoc('gyms/crunch-wakad/devices/dev1/commands/c1'))!.status.stringValue).toBe('done');

  const onlyOurs = received.length;
  expect(await (await send(`devicecmd?SN=${SN}`, 'POST', `ID=${id}&Return=0&CMD=DATA\n`)).text()).toBe('OK');
  expect(received.length).toBe(onlyOurs);                                          // nothing to forward
});

test('a CRM-managed member whose membership expired is recorded as not allowed — and it’s still their visit', async () => {
  await seedDoc('members/m3', { name: 'Lapsed Member', phone: '9000000003', phoneKey: '9000000003', status: 'active', membershipEnd: '2026-01-31', activeUntil: '2026-01-31' });
  await seedDoc('biometricIdentities/dev1_503', { gymId: 'crunch-wakad', memberId: 'm3', deviceId: 'dev1', deviceUserId: '503', method: 'fingerprint', status: 'SYNCED', managedBy: 'crm', accessEnabled: true });
  await send(`cdata?SN=${SN}&table=ATTLOG&Stamp=12350`, 'POST', '503\t2026-09-29 20:00:00\t0\t1\t0\t0\n');
  const ev = (await list('accessEvents')).find((e) => e.fields.deviceUserId.stringValue === '503')!.fields;
  expect(ev.decision.stringValue).toBe('ACCESS_DENIED');
  expect(ev.decisionReason.stringValue).toBe('MEMBERSHIP_EXPIRED');
  expect(ev.result.stringValue).toBe('denied');
  expect(await getDoc('checkins/2026-09-29_m3')).not.toBeNull();                  // the device let them in: it's a visit
  expect((await list('gyms/crunch-wakad/devices/dev1/commands')).filter((c) => c.fields.deviceUserId?.stringValue === '503')).toEqual([]);   // nothing sent to the device
});

test('remote enrolment: the device accepts, and only the device’s own fingerprint report confirms it', async () => {
  await seedDoc('teamMembers/T7', { name: 'Coach Seven', role: 'Coach' });
  await seedDoc('biometricIdentities/dev1_701', { gymId: 'crunch-wakad', personType: 'trainer', memberId: null, trainerId: 'T7', deviceId: 'dev1', deviceUserId: '701', method: 'fingerprint', status: 'PENDING', managedBy: 'crm', accessEnabled: true, enrollment: 'requested' });
  await seedDoc('gyms/crunch-wakad/devices/dev1/commands/e1', { type: 'enroll_fp', deviceUserId: '701', personType: 'trainer', personId: 'T7', status: 'queued', createdBy: 'x' });
  const poll = await (await send(`getrequest?SN=${SN}`)).text();
  const line = poll.split('\n').find((l) => l.includes('ENROLL_FP'))!;
  expect(line).toMatch(/^C:9\d{8}:ENROLL_FP PIN=701\tFID=6\tRETRY=3\tOVERWRITE=0$/);
  const id = line.split(':')[1];
  await send(`devicecmd?SN=${SN}`, 'POST', `ID=${id}&Return=0&CMD=ENROLL_FP\n`);
  expect((await getDoc('gyms/crunch-wakad/devices/dev1/commands/e1'))!.status.stringValue).toBe('done');
  // Accepted is NOT enrolled
  expect((await getDoc('biometricIdentities/dev1_701'))!.enrollment.stringValue).toBe('device_accepted');
  // The device uploads the saved fingerprint (template ignored, never stored)
  await send(`cdata?SN=${SN}&table=OPERLOG&Stamp=6`, 'POST', 'FP PIN=701\tFID=6\tSize=1000\tValid=1\tTMP=SECRETTEMPLATE\n');
  const after = (await getDoc('biometricIdentities/dev1_701'))!;
  expect(after.enrollment.stringValue).toBe('confirmed');
  expect(after.enrollmentEvidence.stringValue).toBe('fingerprint_template_reported');
  const log = await list('activity');
  expect(log.some((a) => a.fields.meta?.mapValue?.fields?.event?.stringValue === 'DEVICE_COMMAND_SUCCESS')).toBe(true);
  expect(log.some((a) => a.fields.meta?.mapValue?.fields?.event?.stringValue === 'ENROLLMENT_CONFIRMED')).toBe(true);
  expect(JSON.stringify(log)).not.toContain('SECRETTEMPLATE');
  expect(JSON.stringify(await list('biometricIdentities'))).not.toContain('SECRETTEMPLATE');
});

test('a refused enrolment is reported as failed, with the device’s code — never as enrolled', async () => {
  await seedDoc('biometricIdentities/dev1_702', { gymId: 'crunch-wakad', personType: 'trainer', memberId: null, trainerId: 'T7', deviceId: 'dev1', deviceUserId: '702', method: 'fingerprint', status: 'PENDING', managedBy: 'crm', accessEnabled: true, enrollment: 'requested' });
  await seedDoc('gyms/crunch-wakad/devices/dev1/commands/e2', { type: 'enroll_fp', deviceUserId: '702', status: 'queued', createdBy: 'x' });
  const line = (await (await send(`getrequest?SN=${SN}`)).text()).split('\n').find((l) => l.includes('PIN=702'))!;
  await send(`devicecmd?SN=${SN}`, 'POST', `ID=${line.split(':')[1]}&Return=-1002&CMD=ENROLL_FP\n`);
  expect((await getDoc('gyms/crunch-wakad/devices/dev1/commands/e2'))!.status.stringValue).toBe('failed');
  const ident = (await getDoc('biometricIdentities/dev1_702'))!;
  expect(ident.enrollment.stringValue).toBe('failed');
  expect(ident.enrollmentError.stringValue).toBe('Device answered -1002');
  expect((await list('activity')).some((a) => a.fields.meta?.mapValue?.fields?.event?.stringValue === 'ENROLLMENT_FAILED')).toBe(true);
});

test('what the OLD server sends the device is recorded as command verbs only — no user details', async () => {
  await send(`getrequest?SN=${SN}`);
  const diag = (await getDoc(`admsDiagnostics/${SN}`))!;
  const recent = JSON.stringify(diag);
  expect(recent).toContain('INFO ×');                                               // the fake old server answers "C:77:INFO"
});

test('ADMS_OUTAGE_MODE=retry (the old behaviour): if the old server is down, nothing is acknowledged — the device keeps the scans and retries', async () => {
  process.env.ADMS_OUTAGE_MODE = 'retry';
  upstreamDown = true;
  try {
    const r = await send(`cdata?SN=${SN}&table=ATTLOG&Stamp=12347`, 'POST', '501\t2026-09-29 19:00:00\t0\t1\t0\t0\n');
    expect(r.status).toBe(503);
    const events = await list('accessEvents');
    expect(events.some((e) => e.fields.at.stringValue === '2026-09-29T13:30:00.000Z')).toBe(false);   // not recorded twice later
  } finally { upstreamDown = false; delete process.env.ADMS_OUTAGE_MODE; }
});

// The default: the CRM keeps working while the old server is down, and the old server gets
// everything it missed — once, in order, with the scans' own times — when it's back.
test('old server down: the CRM answers the device itself and records scans at once; the old server gets them when it’s back', async () => {
  await seedDoc('gyms/crunch-wakad/devices/dev1/commands/o1', { type: 'query_users', status: 'queued', createdBy: 'x' });
  upstreamDown = true;
  const before = received.length;
  try {
    expect(await (await send(`cdata?SN=${SN}&options=all&pushver=2.4.1`)).text()).toContain('PushProtVer=2.4.1');   // the CRM's own handshake
    const poll = await (await send(`getrequest?SN=${SN}`)).text();
    expect(poll).toMatch(/^C:9\d{8}:DATA QUERY USERINFO$/m);                       // CRM commands still go out
    const scan = '501\t2026-10-27 07:15:00\t0\t1\t0\t0\n';
    const up = await send(`cdata?SN=${SN}&table=ATTLOG&Stamp=13000`, 'POST', scan);
    expect(up.status).toBe(200);
    expect(await up.text()).toBe('OK');
    await expect.poll(async () => (await list('accessEvents')).some((e) => e.fields.at.stringValue === '2026-10-27T01:45:00.000Z')).toBe(true);   // recorded now
    expect((await list('admsReplay/JJA1254700696/uploads')).length).toBe(1);        // a copy kept for the old server
    expect(received.length).toBe(before);
    // An unregistered serial isn't answered on the old server's behalf
    expect((await send('getrequest?SN=NOTREGISTERED1')).status).toBe(503);

    // Back: the next request goes to the old server, then it gets the scan it missed — once
    upstreamDown = false;
    expect(await (await send(`getrequest?SN=${SN}`)).text()).toContain('C:77:INFO');
    await expect.poll(() => received.filter((r) => r.url === `/iclock/cdata?SN=${SN}&table=ATTLOG&Stamp=13000`).length).toBe(1);
    expect(received.find((r) => r.url.includes('Stamp=13000'))!.body).toBe(scan);
    await expect.poll(async () => (await list('admsReplay/JJA1254700696/uploads')).length).toBe(0);
    await send(`getrequest?SN=${SN}`);
    expect(received.filter((r) => r.url.includes('Stamp=13000')).length).toBe(1);
  } finally { upstreamDown = false; }
});

// ── Diagnostics ──────────────────────────────────────────────────────────────
const idToken = async () => {
  const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: ADMIN.email, password: ADMIN.password, returnSecureToken: true }),
  });
  return ((await r.json()) as { idToken: string }).idToken;
};

test('every device request leaves a "last contact" record — never a fingerprint template', async () => {
  const d = await getDoc(`admsDiagnostics/${SN}`);
  expect(d).not.toBeNull();
  const raw = JSON.stringify(d);
  expect(raw).toContain('command result');                                          // the latest kinds of request are there
  expect(raw).not.toContain('TMP');                                                 // the FP line's template never stored
  expect(raw).not.toContain('AAAA');
  expect(d!.crmDeviceId.stringValue).toBe('dev1');                                  // matched to the CRM device
});

test('a serial the CRM doesn’t know is recorded (so a typo shows), and still passed on', async () => {
  const before = received.length;
  const r = await send('getrequest?SN=JJ41254700696');
  expect(r.status).toBe(200);
  expect(received.length).toBe(before + 1);                                         // the old server still gets it
  const d = await getDoc('admsDiagnostics/JJ41254700696');
  expect(d!.crmDeviceId).toEqual({ nullValue: null });
  expect(JSON.stringify(d)).toContain('no CRM device has serial JJ41254700696');
  const dev = await getDoc('gyms/crunch-wakad/devices/dev1');
  expect(dev!.serialNumber.stringValue).toBe(SN);                                   // nothing about the real device changed
});

test('the reserved self-test serial is answered by the relay itself — never sent to the old server', async () => {
  const before = received.length;
  const hs = await (await send('cdata?SN=CRUNCH-PROBE&options=all')).text();
  expect(hs.startsWith('GET OPTION FROM: CRUNCH-PROBE')).toBe(true);
  expect(await (await send('getrequest?SN=CRUNCH-PROBE')).text()).toBe('OK');
  expect(received.length).toBe(before);                                             // nothing reached the old server
  expect((await list('accessEvents')).some((e) => e.fields.deviceUserId.stringValue === 'CRUNCH-PROBE')).toBe(false);
});

test('diagnostics: health is public; status and self-test are admins only, and tell the truth', async () => {
  await seedAdmin();
  const health = await (await fetch(`${relayUrl}/api/adms?check=health`)).json() as { alive: boolean; recording: boolean };
  expect(health).toMatchObject({ alive: true, recording: true });
  expect((await fetch(`${relayUrl}/api/adms?check=status`)).status).toBe(401);
  const token = await idToken();
  const auth = { headers: { Authorization: `Bearer ${token}` } };
  const status = await (await fetch(`${relayUrl}/api/adms?check=status`, auth)).json() as { contacts: { sn: string; state: string; last: { kind: string } }[] };
  const real = status.contacts.find((c) => c.sn === SN)!;
  expect(real.state).toBe('connected');                                             // a real request from a registered serial
  expect(status.contacts.find((c) => c.sn === 'JJ41254700696')!.state).toBe('unregistered serial');
  expect(status.contacts.find((c) => c.sn === 'CRUNCH-PROBE')!.state).toBe('self-test');

  const before = received.length;
  const test = await (await fetch(`${relayUrl}/api/adms?check=selftest`, { method: 'POST', ...auth })).json() as { ok: boolean; steps: { step: string; ok: boolean; detail: string }[] };
  expect(test.steps.map((s) => s.step)).toEqual(['DNS', 'HTTPS and /iclock route (handshake)', 'Command poll (getrequest)', 'Recording (Firestore)', 'Old attendance server reachable (TCP only)']);
  expect(test.steps.every((s) => s.ok), JSON.stringify(test.steps)).toBe(true);
  expect(received.length).toBe(before);                                             // the self-test never talks HTTP to the old server
});

test('firmware that adds ".aspx" (this X2008: /iclock/getrequest.aspx) works the same — and is forwarded as sent', async () => {
  // A scan upload to cdata.aspx: forwarded byte for byte to the same path, and recorded
  const attlog = '501\t2026-09-30 11:52:00\t0\t1\t0\t0\n';
  const up = await send(`cdata.aspx?SN=${SN}&table=ATTLOG&Stamp=20000`, 'POST', attlog);
  expect(await up.text()).toBe('OK: 1');
  expect(received.at(-1)!.url).toBe(`/iclock/cdata.aspx?SN=${SN}&table=ATTLOG&Stamp=20000`);
  expect(received.at(-1)!.body).toBe(attlog);
  expect((await list('accessEvents')).some((e) => e.fields.at.stringValue === '2026-09-30T06:22:00.000Z')).toBe(true);

  // A command poll to getrequest.aspx carries the CRM's queued command
  await seedDoc('gyms/crunch-wakad/devices/dev1/commands/c9', { type: 'enroll_fp', deviceUserId: '10062', status: 'queued', createdBy: 'x' });
  const poll = await (await send(`getrequest.aspx?SN=${SN}`)).text();
  expect(received.at(-1)!.url).toBe(`/iclock/getrequest.aspx?SN=${SN}`);
  const ours = poll.split('\n').find((l) => l.includes('ENROLL_FP'))!;
  expect(ours).toMatch(/^C:9\d{8}:ENROLL_FP PIN=10062\t/);

  // …and its result, posted to devicecmd.aspx, is handled here (nothing to forward)
  const before = received.length;
  expect(await (await send(`devicecmd.aspx?SN=${SN}`, 'POST', `ID=${ours.split(':')[1]}&Return=0&CMD=ENROLL_FP\n`)).text()).toBe('OK');
  expect(received.length).toBe(before);
  expect((await getDoc('gyms/crunch-wakad/devices/dev1/commands/c9'))!.status.stringValue).toBe('done');
  expect(JSON.stringify(await getDoc(`admsDiagnostics/${SN}`))).toContain('command result');
});

// ── Firestore usage at production timing ─────────────────────────────────────
// The device polls every 3–4 s. Every request must still reach the old server and get the same
// answer; only the relay's own database writes are spaced out — without losing any count.
const mapNum = (f: unknown, k: string) => Number((f as { mapValue?: { fields?: Record<string, { integerValue?: string }> } })?.mapValue?.fields?.[k]?.integerValue ?? 0);
const production = () => { process.env.ADMS_ROUTINE_RECORD_MS = '600000'; process.env.ADMS_HEARTBEAT_MS = '600000'; process.env.ADMS_COMMAND_CHECK_MS = '600000'; };
const immediate = () => { process.env.ADMS_ROUTINE_RECORD_MS = '0'; process.env.ADMS_HEARTBEAT_MS = '0'; process.env.ADMS_COMMAND_CHECK_MS = '0'; };

test('routine polls: all forwarded and answered as before, but the contact record is written once per interval — with exact totals', async () => {
  production();
  await send(`cdata?SN=${SN}&options=all&pushver=2.4.1`);                         // a handshake is always recorded
  const d0 = (await getDoc(`admsDiagnostics/${SN}`))!;
  const dev0 = (await getDoc('gyms/crunch-wakad/devices/dev1'))!;
  const before = received.length;
  for (let i = 0; i < 20; i++) expect(await (await send(`getrequest?SN=${SN}`)).text()).toContain('C:77:INFO');   // the old server's commands still reach the device
  expect(received.length).toBe(before + 20);                                        // every poll still reaches the old server
  const d1 = (await getDoc(`admsDiagnostics/${SN}`))!;
  expect(JSON.stringify(d1.counts)).toBe(JSON.stringify(d0.counts));               // no database write for routine polls…
  expect(JSON.stringify((await getDoc('gyms/crunch-wakad/devices/dev1'))!.lastSeenAt)).toBe(JSON.stringify(dev0.lastSeenAt));   // …nor a heartbeat
  await send(`cdata?SN=${SN}&options=all&pushver=2.4.1`);                          // the next meaningful request writes the totals
  const d2 = (await getDoc(`admsDiagnostics/${SN}`))!;
  expect(mapNum(d2.counts, 'command poll') - mapNum(d0.counts, 'command poll')).toBe(20);   // exact, not sampled
  expect(mapNum(d2.counts, 'handshake') - mapNum(d0.counts, 'handshake')).toBe(1);
  expect(mapNum(d2.usage, 'writes.diagnostics') - mapNum(d0.usage, 'writes.diagnostics')).toBe(1);   // 22 requests → 1 write
  expect(mapNum(d2.usage, 'reads.diagnostics')).toBeGreaterThan(0);
  expect(mapNum(d2.usage, 'writes.punches')).toBeGreaterThan(0);                    // punch costs are measured too
  immediate();
});

test('an error is recorded at once, and the next good request clears it at once — even at production timing', async () => {
  production();
  upstreamDown = true;
  expect((await send(`getrequest?SN=${SN}`)).status).toBe(200);                    // the CRM answers on its own…
  upstreamDown = false;
  expect(((await getDoc(`admsDiagnostics/${SN}`))!.last as { mapValue: { fields: { note: { stringValue: string } } } }).mapValue.fields.note.stringValue).toContain('answered by the CRM');
  expect((await getDoc('gyms/crunch-wakad/devices/dev1'))!.lastError.stringValue).toContain('isn’t answering');   // …and says so
  await send(`getrequest?SN=${SN}`);
  expect((await getDoc('gyms/crunch-wakad/devices/dev1'))!.lastError).toEqual({ nullValue: null });   // cleared at once, not in 10 minutes
  immediate();
});

test('commands: a queued request waits for the next check; several queued ones drain on consecutive polls', async () => {
  production();
  process.env.ADMS_COMMAND_LISTEN = '0';                                            // the periodic check alone (no fast lane)
  await seedDoc('gyms/crunch-wakad/devices/dev1/commands/w1', { type: 'query_users', status: 'queued', createdBy: 'x' });
  expect(await (await send(`getrequest?SN=${SN}`)).text()).not.toContain('USERINFO');   // checked recently: not yet
  expect((await getDoc('gyms/crunch-wakad/devices/dev1/commands/w1'))!.status.stringValue).toBe('queued');
  process.env.ADMS_COMMAND_CHECK_MS = '0';                                          // the check interval has passed
  for (let i = 2; i <= 7; i++) await seedDoc(`gyms/crunch-wakad/devices/dev1/commands/w${i}`, { type: 'query_users', status: 'queued', createdBy: 'x' });
  const first = (await (await send(`getrequest?SN=${SN}`)).text()).split('\n').filter((l) => l.startsWith('C:9'));
  expect(first).toHaveLength(5);                                                     // 5 per poll, as before
  process.env.ADMS_COMMAND_CHECK_MS = '600000';                                     // back to production timing…
  const second = (await (await send(`getrequest?SN=${SN}`)).text()).split('\n').filter((l) => l.startsWith('C:9'));
  expect(second).toHaveLength(2);                                                    // …yet the rest go on the very next poll
  const third = (await (await send(`getrequest?SN=${SN}`)).text()).split('\n').filter((l) => l.startsWith('C:9'));
  expect(third).toHaveLength(0);
  delete process.env.ADMS_COMMAND_LISTEN;
  immediate();
});

// Safety switch for a controlled device test: ADMS_DELIVER_CRM_COMMANDS=0 → no CRM command reaches the device
test('ADMS_DELIVER_CRM_COMMANDS=0: no CRM command is delivered, the queue is left untouched, the old server’s commands still flow', async () => {
  const fresh = ts(new Date().toISOString());
  const queued = {
    s1: { type: 'unlock_door', status: 'queued', createdBy: 'x', createdAt: fresh },
    s2: { type: 'add_user', deviceUserId: '10071', name: 'Switch Test', status: 'queued', createdBy: 'x', createdAt: fresh },
    s3: { type: 'enroll_fp', deviceUserId: '10071', status: 'queued', createdBy: 'x', createdAt: fresh },
    s4: { type: 'query_users', status: 'queued', createdBy: 'x', createdAt: fresh },
    s5: { type: 'unlock_door', status: 'queued', createdBy: 'x', createdAt: ts(new Date(Date.now() - 120_000).toISOString()) },   // stale
  };
  for (const [id, c] of Object.entries(queued)) await seedDoc(`gyms/crunch-wakad/devices/dev1/commands/${id}`, c);
  process.env.ADMS_DELIVER_CRM_COMMANDS = '0';
  for (let i = 0; i < 3; i++) {
    const before = received.length;
    expect(await (await send(`getrequest.aspx?SN=${SN}`)).text()).toBe('C:77:INFO');   // exactly the old server's reply, nothing added
    expect(received.at(before)!.url).toBe(`/iclock/getrequest.aspx?SN=${SN}`);         // still forwarded
  }
  // The old server's command results still go to it, unchanged
  await send(`devicecmd.aspx?SN=${SN}`, 'POST', 'ID=77&Return=0&CMD=INFO\n');
  expect(received.at(-1)!.body).toBe('ID=77&Return=0&CMD=INFO\n');
  // Every CRM command is exactly as queued: not sent, no command id, not even the stale unlock expired
  for (const id of Object.keys(queued)) {
    const d = (await getDoc(`gyms/crunch-wakad/devices/dev1/commands/${id}`))!;
    expect(d.status.stringValue).toBe('queued');
    expect(d.commandId).toBeUndefined();
    expect(d.sentAt).toBeUndefined();
    expect(d.error).toBeUndefined();
  }
  // Any other value (and absent, below) is the normal behaviour: delivered on the next poll
  process.env.ADMS_DELIVER_CRM_COMMANDS = '1';
  const lines = (await (await send(`getrequest.aspx?SN=${SN}`)).text()).split('\n');
  expect(lines).toContain('C:77:INFO');
  expect(lines.filter((l) => l.startsWith('C:9'))).toHaveLength(4);                   // all but the stale unlock
  expect(lines.some((l) => l.endsWith(':AC_UNLOCK'))).toBe(true);
  expect((await getDoc('gyms/crunch-wakad/devices/dev1/commands/s5'))!.status.stringValue).toBe('failed');   // expired, never sent
  for (const id of ['s1', 's2', 's3', 's4']) expect((await getDoc(`gyms/crunch-wakad/devices/dev1/commands/${id}`))!.status.stringValue).toBe('sent');
  delete process.env.ADMS_DELIVER_CRM_COMMANDS;
  await seedDoc('gyms/crunch-wakad/devices/dev1/commands/s6', { type: 'query_users', status: 'queued', createdBy: 'x', createdAt: ts(new Date().toISOString()) });
  expect((await (await send(`getrequest.aspx?SN=${SN}`)).text()).split('\n').filter((l) => l.startsWith('C:9'))).toHaveLength(1);
  expect((await getDoc('gyms/crunch-wakad/devices/dev1/commands/s6'))!.status.stringValue).toBe('sent');
});

// "Open door" in the admin header: one AC_UNLOCK to the device; "released" only on the device's Return=0
const ours = (text: string, cmd: string) => text.split('\n').find((l) => l.startsWith('C:9') && l.endsWith(`:${cmd}`));
test('open door: sent to the device as AC_UNLOCK; done and logged only when the device answers Return=0', async () => {
  await seedDoc('gyms/crunch-wakad/devices/dev1/commands/u1', { type: 'unlock_door', status: 'queued', createdBy: 'x', createdAt: ts(new Date().toISOString()) });
  const line = ours(await (await send(`getrequest?SN=${SN}`)).text(), 'AC_UNLOCK')!;
  expect(line).toMatch(/^C:9\d{8}:AC_UNLOCK$/);
  expect((await getDoc('gyms/crunch-wakad/devices/dev1/commands/u1'))!.status.stringValue).toBe('sent');   // sent is not opened
  await send(`devicecmd?SN=${SN}`, 'POST', `ID=${line.split(':')[1]}&Return=0&CMD=AC_UNLOCK\n`);
  expect((await getDoc('gyms/crunch-wakad/devices/dev1/commands/u1'))!.status.stringValue).toBe('done');
  expect((await list('activity')).some((a) => a.fields.meta?.mapValue?.fields?.event?.stringValue === 'DOOR_UNLOCKED')).toBe(true);
  // A refusal is a failure with the device's code
  await seedDoc('gyms/crunch-wakad/devices/dev1/commands/u2', { type: 'unlock_door', status: 'queued', createdBy: 'x', createdAt: ts(new Date().toISOString()) });
  const line2 = ours(await (await send(`getrequest?SN=${SN}`)).text(), 'AC_UNLOCK')!;
  await send(`devicecmd?SN=${SN}`, 'POST', `ID=${line2.split(':')[1]}&Return=-1&CMD=AC_UNLOCK\n`);
  const u2 = (await getDoc('gyms/crunch-wakad/devices/dev1/commands/u2'))!;
  expect(u2.status.stringValue).toBe('failed');
  expect(u2.returnCode.stringValue).toBe('-1');
  expect((await list('activity')).some((a) => a.fields.meta?.mapValue?.fields?.event?.stringValue === 'DOOR_UNLOCK_FAILED')).toBe(true);
});

test('open door: a request the device didn’t collect within 30 s expires and is never sent later', async () => {
  await seedDoc('gyms/crunch-wakad/devices/dev1/commands/u3', { type: 'unlock_door', status: 'queued', createdBy: 'x', createdAt: ts(new Date(Date.now() - 120_000).toISOString()) });
  expect(await (await send(`getrequest?SN=${SN}`)).text()).not.toContain('AC_UNLOCK');
  const u3 = (await getDoc('gyms/crunch-wakad/devices/dev1/commands/u3'))!;
  expect(u3.status.stringValue).toBe('failed');
  expect(u3.error.stringValue).toContain('Expired');
  expect(await (await send(`getrequest?SN=${SN}`)).text()).not.toContain('AC_UNLOCK');
});

test('open door at production timing: the queue listener delivers it on the next poll, not after the periodic check', async () => {
  await send(`getrequest?SN=${SN}`);                                                // listener is up for this device
  production();                                                                     // periodic check: 10 minutes
  await send(`getrequest?SN=${SN}`);
  await send(`getrequest?SN=${SN}`);                                                // checked just now
  await seedDoc('gyms/crunch-wakad/devices/dev1/commands/u4', { type: 'unlock_door', status: 'queued', createdBy: 'x', createdAt: ts(new Date().toISOString()) });
  await expect.poll(async () => ours(await (await send(`getrequest?SN=${SN}`)).text(), 'AC_UNLOCK') ?? '', { timeout: 8000 }).toMatch(/AC_UNLOCK$/);
  expect((await getDoc('gyms/crunch-wakad/devices/dev1/commands/u4'))!.status.stringValue).toBe('sent');
  immediate();
});

// ── Shared write gate (Cloudflare runs several instances at once) ─────────────────────────────
// Routine bookkeeping (the device's "last seen", the contact record) is written once per interval
// in total: when the gate says another instance already wrote it, this one writes nothing — and
// the device still gets the old server's answer. Errors are recorded whatever the gate says.
test('write gate: routine heartbeat and contact record are skipped when another instance already wrote them; errors are always recorded', async () => {
  const { registerWriteGate } = await import('../../api/iclock');
  const asked: string[] = [];
  let allow = false;
  registerWriteGate({ async claim(key) { asked.push(key); return allow; } });
  production();
  const SN2 = 'GATE00000001', SN3 = 'GATE00000002';
  await seedDoc('gyms/crunch-wakad/devices/devG1', { gymId: 'crunch-wakad', name: 'Gate test 1', model: 'eSSL X2008', serialNumber: SN2, protocol: 'adms', enabled: true, nextUserId: 1, lastSeenAt: null, lastSyncAt: null, firmware: null, lastError: null });
  await seedDoc('gyms/crunch-wakad/devices/devG2', { gymId: 'crunch-wakad', name: 'Gate test 2', model: 'eSSL X2008', serialNumber: SN3, protocol: 'adms', enabled: true, nextUserId: 1, lastSeenAt: null, lastSyncAt: null, firmware: null, lastError: null });

  // Another instance already wrote both within the interval: nothing is written, the device is answered as before
  for (let i = 0; i < 3; i++) expect(await (await send(`getrequest?SN=${SN2}`)).text()).toBe('C:77:INFO');
  expect(asked).toEqual(expect.arrayContaining(['heartbeat/devG1', `diagnostics/${SN2}`]));
  expect((await getDoc('gyms/crunch-wakad/devices/devG1'))!.lastSeenAt).toEqual({ nullValue: null });
  expect(await getDoc(`admsDiagnostics/${SN2}`)).toBeNull();

  // This instance is the first in the interval: both are written
  allow = true;
  expect(await (await send(`getrequest?SN=${SN3}`)).text()).toBe('C:77:INFO');
  expect((await getDoc('gyms/crunch-wakad/devices/devG2'))!.lastSeenAt).toHaveProperty('timestampValue');
  expect(await getDoc(`admsDiagnostics/${SN3}`)).not.toBeNull();

  // An error (old server down) is recorded at once, even when the gate would say "already written"
  allow = false;
  upstreamDown = true;
  expect((await send(`getrequest?SN=${SN2}`)).status).toBe(200);                  // answered by the CRM (old server down)
  upstreamDown = false;
  const d = (await getDoc(`admsDiagnostics/${SN2}`))!;
  expect(JSON.stringify(d)).toContain('old server unreachable');

  registerWriteGate({ async claim() { return true; } });
  immediate();
});

// The X2008 got stuck on 27 Oct 2026: the old server dropped a 65 KB upload of fingerprint
// templates, the relay answered 503, and the device re-sent that one upload for hours — so no
// scans and no commands got through behind it.
const fpLine = (pin: number) => `FP PIN=${pin}\tFID=6\tSize=1500\tValid=1\tTMP=${'A'.repeat(1500)}`;
const FP_UPLOAD = Array.from({ length: 42 }, (_, i) => fpLine(20001 + i)).join('\n') + '\n';

test('a big upload without scans that the old server drops is sent again in pieces — every line reaches it', async () => {
  upstreamMaxBody = 20_000;
  const before = received.length;
  const r = await send(`cdata?SN=${SN}&table=OPERLOG&Stamp=9999`, 'POST', FP_UPLOAD);
  expect(r.status).toBe(200);
  const pieces = received.slice(before).filter((x) => x.url.includes('table=OPERLOG'));
  expect(pieces.length).toBeGreaterThan(2);
  expect(pieces.every((x) => x.body.length <= 20_000 && x.url === `/iclock/cdata?SN=${SN}&table=OPERLOG&Stamp=9999`)).toBe(true);
  expect(pieces.map((x) => x.body).join('')).toBe(FP_UPLOAD);
  expect(JSON.stringify(await getDoc(`admsDiagnostics/${SN}`))).toContain('it took it in');
  upstreamMaxBody = Infinity;
});

test('ADMS_OUTAGE_MODE=retry: an upload without scans the old server keeps refusing is acknowledged after 3 tries; scans never are', async () => {
  process.env.ADMS_OUTAGE_MODE = 'retry';
  upstreamDown = true;
  const statuses: number[] = [];
  for (let i = 0; i < 3; i++) statuses.push((await send(`cdata?SN=${SN}&table=OPERLOG&Stamp=9999`, 'POST', FP_UPLOAD)).status);
  expect(statuses).toEqual([503, 503, 200]);
  const last = ((await getDoc(`admsDiagnostics/${SN}`)) as unknown as { last: { mapValue: { fields: Record<string, { stringValue?: string; booleanValue?: boolean; nullValue?: null }> } } }).last.mapValue.fields;
  expect(last.note.stringValue).toContain('acknowledged so the device moves on');
  expect(last).toMatchObject({ status: { integerValue: '200' }, upstreamStatus: { nullValue: null } });   // the old server never took it
  // Scans: refused every time, however often the device tries
  const scans: number[] = [];
  for (let i = 0; i < 5; i++) scans.push((await send(`cdata?SN=${SN}&table=ATTLOG&Stamp=1`, 'POST', '10061\t2026-10-27 09:00:00\t0\t1\t0\t0\n')).status);
  expect(scans).toEqual([503, 503, 503, 503, 503]);
  // A user record mixed with a scan counts as scans: never acknowledged without the old server
  const mixed: number[] = [];
  for (let i = 0; i < 4; i++) mixed.push((await send(`cdata?SN=${SN}&table=OPERLOG&Stamp=2`, 'POST', `USER PIN=10061\tName=X\n10061\t2026-10-27 09:00:00\t0\t1\t0\t0\n`)).status);
  upstreamDown = false;
  delete process.env.ADMS_OUTAGE_MODE;
  expect(mixed).toEqual([503, 503, 503, 503]);
});

// Production since 27 Oct 2026 (ADMS_UPSTREAM="none"): the CRM answers the X2008 itself. The device
// gets the old server's own settings, every scan is recorded and acknowledged, CRM commands still
// go out — and nothing at all is sent to the old server.
test('without the old server: the CRM answers the device itself and records everything', async () => {
  const saved = process.env.ADMS_UPSTREAM;
  process.env.ADMS_UPSTREAM = 'none';
  const before = received.length;
  try {
    const hs = await (await send(`cdata?SN=${SN}&options=all&pushver=2.4.1`)).text();
    expect(hs).toContain(`GET OPTION FROM: ${SN}`);
    for (const o of ['ATTLOGStamp=None', 'OPERLOGStamp=None', 'Delay=3', 'TransFlag=1111000000', 'PushProtVer=2.4.1', 'Realtime=1']) expect(hs).toContain(o);

    const up = await send(`cdata?SN=${SN}&table=ATTLOG&Stamp=20000`, 'POST', '501\t2026-10-27 18:05:10\t0\t1\t0\t0\n');
    expect(up.status).toBe(200);
    expect(await up.text()).toBe('OK');
    await expect.poll(async () => (await list('accessEvents')).some((e) => JSON.stringify(e.fields).includes('2026-10-27T12:35:10'))).toBe(true);

    // The upload that stuck the device on 27 Oct: taken at once
    expect((await send(`cdata?SN=${SN}&table=OPERLOG&Stamp=9999`, 'POST', FP_UPLOAD)).status).toBe(200);

    await seedDoc('gyms/crunch-wakad/devices/dev1/commands/n1', { type: 'add_user', deviceUserId: '20001', name: 'Neha New', status: 'queued', createdBy: 'x' });
    const poll = await (await send(`getrequest?SN=${SN}`)).text();
    expect(poll).toMatch(/^C:9\d{8}:DATA UPDATE USERINFO PIN=20001\tName=Neha New\t/m);
    expect(poll).not.toContain('C:77:INFO');                                       // no old-server commands any more
    const id = poll.split('\n').find((l) => l.includes('PIN=20001'))!.split(':')[1];
    expect(await (await send(`devicecmd?SN=${SN}`, 'POST', `ID=${id}&Return=0&CMD=DATA\n`)).text()).toBe('OK');
    expect((await getDoc('gyms/crunch-wakad/devices/dev1/commands/n1'))!.status.stringValue).toBe('done');

    expect(received.length).toBe(before);                                          // the old server got nothing
  } finally {
    process.env.ADMS_UPSTREAM = saved;
  }
});

test('the device’s own options upload is kept (what its firmware supports) — and still passed on', async () => {
  const opts = '~DeviceName=X2008,FWVersion=Ver 6.60,UserCount=537,FPCount=1100,~MaxUserCount=30,IPAddress=192.168.1.201';
  const before = received.length;
  expect((await send(`cdata?SN=${SN}&table=options`, 'POST', opts)).status).toBe(200);
  expect(received.length).toBe(before + 1);
  await expect.poll(async () => (await getDoc(`admsDiagnostics/${SN}_options`))?.deviceOptions?.stringValue).toBe(opts);
});

test('the options record is not listed as another device; it comes with its device', async () => {
  const r = await fetch(`${relayUrl}/api/adms?check=status`, { headers: { Authorization: `Bearer ${await idToken()}` } });
  const j = await r.json() as { contacts: { sn: string; deviceOptions: { text: string } | null }[] };
  expect(j.contacts.filter((c) => c.sn === SN)).toHaveLength(1);
  expect(j.contacts.find((c) => c.sn === SN)!.deviceOptions!.text).toContain('FWVersion');
  expect(j.contacts.some((c) => c.sn.endsWith('_options'))).toBe(false);
});

// The old server deletes every user it doesn't know from the device — including the CRM's own.
test('the old server can’t delete CRM users from the device; its own users it still can — and it hears “done”', async () => {
  await seedDoc('biometricIdentities/dev1_20005', { gymId: 'crunch-wakad', personType: 'member', memberId: 'm1', trainerId: null, deviceId: 'dev1', deviceUserId: '20005', method: 'fingerprint', status: 'SYNCED', managedBy: 'crm', accessEnabled: true, enrollment: 'confirmed' });
  await seedDoc('biometricIdentities/dev1_20006', { gymId: 'crunch-wakad', personType: 'member', memberId: 'm1', trainerId: null, deviceId: 'dev1', deviceUserId: '20006', method: 'fingerprint', status: 'REMOVED', managedBy: 'crm', accessEnabled: true, enrollment: 'confirmed' });
  upstreamPoll = 'C:501:DATA DELETE USERINFO PIN=20005\nC:502:DATA DELETE USERINFO PIN=502\nC:503:DATA DELETE FINGERTMP PIN=20005\tFID=6\nC:504:DATA DELETE USERINFO PIN=20006\nC:505:DATA UPDATE USERINFO PIN=20005\tName=X\tTZ=0000000100000000\n';
  try {
    const poll = await (await send(`getrequest?SN=${SN}`)).text();
    expect(poll).toContain('C:502:DATA DELETE USERINFO PIN=502');                  // an old-system user: passed on
    expect(poll).toContain('C:504:DATA DELETE USERINFO PIN=20006');                // a link the CRM removed: passed on
    expect(poll).not.toContain('PIN=20005');                                         // a CRM user: kept from the device
    const d = (await getDoc(`admsDiagnostics/${SN}`)) as unknown as { last: { mapValue: { fields: { note: { stringValue: string } } } } };
    expect(d.last.mapValue.fields.note.stringValue).toContain('kept the old server from deleting or changing CRM users 20005');

    // The device reports what it did; the old server also hears its two deletes of 20005 as done
    const before = received.length;
    await send(`devicecmd?SN=${SN}`, 'POST', 'ID=502&Return=0&CMD=DATA\nID=504&Return=0&CMD=DATA\n');
    expect(received.length).toBe(before + 1);
    expect(received.at(-1)!.body).toBe('ID=502&Return=0&CMD=DATA\nID=504&Return=0&CMD=DATA\nID=501&Return=0&CMD=DATA\nID=503&Return=0&CMD=DATA\nID=505&Return=0&CMD=DATA\n');
    // …once only
    await send(`devicecmd?SN=${SN}`, 'POST', 'ID=77&Return=0&CMD=INFO\n');
    expect(received.at(-1)!.body).toBe('ID=77&Return=0&CMD=INFO\n');
  } finally { upstreamPoll = null; }
});

// Blocking CRM-managed users ON the device (ADMS_ENFORCE_ACCESS). Old-system users never touched.
test('access control on the device: dry run records only; "on" blocks an expired CRM user, a renewal unblocks', async () => {
  await seedDoc('members/mx', { name: 'Exp Ired', phone: '9000000777', phoneKey: '9000000777', status: 'active', membershipEnd: '2026-01-01', activeUntil: '2026-01-01' });
  await seedDoc('biometricIdentities/dev1_20010', { gymId: 'crunch-wakad', personType: 'member', memberId: 'mx', trainerId: null, deviceId: 'dev1', deviceUserId: '20010', method: 'fingerprint', status: 'SYNCED', managedBy: 'crm', accessEnabled: true, enrollment: 'confirmed' });
  await seedDoc('biometricIdentities/dev1_10070', { gymId: 'crunch-wakad', personType: 'member', memberId: 'mx', trainerId: null, deviceId: 'dev1', deviceUserId: '10070', method: 'fingerprint', status: 'SYNCED' });   // old system
  const cmds = async () => (await list('gyms/crunch-wakad/devices/dev1/commands')).map((d) => d.fields).filter((f) => /block_user/.test(f.type.stringValue ?? ''));
  process.env.ADMS_ENFORCE_FULL_MS = '0';
  try {
    process.env.ADMS_ENFORCE_ACCESS = 'dry';
    await send(`getrequest?SN=${SN}`);
    await expect.poll(async () => JSON.stringify(await getDoc(`admsDiagnostics/${SN}_enforce`))).toContain('20010');
    const dry = JSON.stringify(await getDoc(`admsDiagnostics/${SN}_enforce`));
    expect(dry).toContain('MEMBERSHIP_EXPIRED');
    expect(dry).not.toContain('10070');
    expect(await cmds()).toEqual([]);                                               // dry: nothing for the device

    process.env.ADMS_ENFORCE_ACCESS = 'on';
    await send(`getrequest?SN=${SN}`);                                               // works out the change (after answering)
    await expect.poll(async () => (await cmds()).map((f) => `${f.type.stringValue}:${f.deviceUserId.stringValue}`).sort().join()).toBe('block_user:20010,block_user:503');   // 503: the CRM member whose membership lapsed (earlier test)
    let poll = '';
    await expect.poll(async () => { poll = await (await send(`getrequest?SN=${SN}`)).text(); return poll; }).toMatch(/DATA UPDATE USERINFO PIN=20010\t.*TZ=0001000000000000/);
    expect(poll).not.toContain('PIN=10070');
    const cid = poll.split('\n').find((l) => l.includes('PIN=20010'))!.split(':')[1];
    await send(`devicecmd?SN=${SN}`, 'POST', `ID=${cid}&Return=0&CMD=DATA\n`);
    await expect.poll(async () => (await getDoc('biometricIdentities/dev1_20010'))!.deviceAccess?.stringValue).toBe('blocked');
    // Polls go on; nothing is sent twice
    await send(`getrequest?SN=${SN}`); await send(`getrequest?SN=${SN}`);
    expect((await cmds()).length).toBe(2);

    // Renewal (the member record changes) → picked up by the quick check → unblocked
    process.env.ADMS_ENFORCE_FULL_MS = '3600000'; process.env.ADMS_ENFORCE_QUICK_MS = '0';
    await seedDoc('members/mx', { name: 'Exp Ired', phone: '9000000777', phoneKey: '9000000777', status: 'active', membershipEnd: '2099-01-01', activeUntil: '2099-01-01', updatedAt: ts(new Date().toISOString()) });
    await send(`getrequest?SN=${SN}`);
    await expect.poll(async () => (await cmds()).some((f) => f.type.stringValue === 'unblock_user')).toBe(true);
    await expect.poll(async () => { poll = await (await send(`getrequest?SN=${SN}`)).text(); return poll; }).toMatch(/DATA UPDATE USERINFO PIN=20010\t.*TZ=0000000100000000/);
    const uid = poll.split('\n').find((l) => l.includes('PIN=20010'))!.split(':')[1];
    await send(`devicecmd?SN=${SN}`, 'POST', `ID=${uid}&Return=0&CMD=DATA\n`);
    await expect.poll(async () => (await getDoc('biometricIdentities/dev1_20010'))!.deviceAccess?.stringValue).toBe('open');
  } finally {
    delete process.env.ADMS_ENFORCE_ACCESS; delete process.env.ADMS_ENFORCE_FULL_MS; delete process.env.ADMS_ENFORCE_QUICK_MS;
  }
});

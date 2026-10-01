import { test, expect } from '@playwright/test';
import http from 'node:http';
import { PassThrough } from 'node:stream';
import type { AddressInfo } from 'node:net';
import { ADMIN, AUTH, FS, PROJECT, resetFirestore, seedAdmin, seedDoc } from './emulator';

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
      if (upstreamDown) { req.socket.destroy(); return; }
      received.push({ method: req.method!, url: req.url!, body });
      const u = new URL(req.url!, 'http://x');
      u.pathname = u.pathname.replace(/\.aspx$/, '');   // real ADMS servers answer both forms
      res.setHeader('Content-Type', 'text/plain');
      if (u.pathname === '/iclock/cdata' && req.method === 'GET') res.end(`GET OPTION FROM: ${u.searchParams.get('SN')}\nATTLOGStamp=12345\nDelay=10`);
      else if (u.pathname === '/iclock/cdata') res.end(`OK: ${body.split('\n').filter(Boolean).length}`);
      else if (u.pathname === '/iclock/getrequest') res.end('C:77:INFO');
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
  await seedDoc('biometricIdentities/dev1_501', { gymId: 'crunch-wakad', memberId: 'm1', deviceId: 'dev1', deviceUserId: '501', method: 'fingerprint', status: 'PENDING' });
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

test('every punch is kept; linked members are judged by their membership, unlinked users stay unresolved', async () => {
  const events = await list('accessEvents');
  expect(events.map((e) => e.fields.deviceUserId.stringValue).sort()).toEqual(['501', '502', '999']);
  const unknown = events.find((e) => e.fields.deviceUserId.stringValue === '999')!.fields;
  expect(unknown.personType.stringValue).toBe('unknown');                         // kept, not matched to anyone
  expect(unknown.result.stringValue).toBe('unknown_user');
  expect(unknown.memberId).toEqual({ nullValue: null });
  const asha = events.find((e) => e.fields.deviceUserId.stringValue === '501')!.fields;
  expect(asha.result.stringValue).toBe('granted');
  expect(asha.at.stringValue).toBe('2026-09-29T12:35:10.000Z');                  // 18:05:10 India time
  expect(asha.verify.stringValue).toBe('fingerprint');
  expect(events.find((e) => e.fields.deviceUserId.stringValue === '502')!.fields.result.stringValue).toBe('denied');   // expired
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

test('if the old server is down, nothing is acknowledged — the device keeps the scans and retries', async () => {
  upstreamDown = true;
  const r = await send(`cdata?SN=${SN}&table=ATTLOG&Stamp=12347`, 'POST', '501\t2026-09-29 19:00:00\t0\t1\t0\t0\n');
  expect(r.status).toBe(503);
  const events = await list('accessEvents');
  expect(events.some((e) => e.fields.at.stringValue === '2026-09-29T13:30:00.000Z')).toBe(false);   // not recorded twice later
  upstreamDown = false;
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
  expect((await send(`getrequest?SN=${SN}`)).status).toBe(503);
  upstreamDown = false;
  expect(((await getDoc(`admsDiagnostics/${SN}`))!.last as { mapValue: { fields: { status: { integerValue: string } } } }).mapValue.fields.status.integerValue).toBe('503');
  expect((await getDoc('gyms/crunch-wakad/devices/dev1'))!.lastError.stringValue).toContain('didn’t answer');
  await send(`getrequest?SN=${SN}`);
  expect((await getDoc('gyms/crunch-wakad/devices/dev1'))!.lastError).toEqual({ nullValue: null });   // cleared at once, not in 10 minutes
  immediate();
});

test('commands: a queued request waits for the next check; several queued ones drain on consecutive polls', async () => {
  production();
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
  immediate();
});

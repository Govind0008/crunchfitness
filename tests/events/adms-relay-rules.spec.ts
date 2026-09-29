import { test, expect } from '@playwright/test';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { FS, PROJECT, resetFirestore, seedDoc } from './emulator';

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
  process.env.GCLOUD_PROJECT = PROJECT;
  const { default: handler } = await import('../../api/iclock');

  // A minimal Vercel-style wrapper around the handler
  relay = http.createServer((req, res) => {
    const url = new URL(req.url!, 'http://relay');
    const m = url.pathname.match(/^\/iclock\/(.*)$/);
    const query: Record<string, string> = Object.fromEntries(url.searchParams);
    if (m) { query.path = m[1]; url.searchParams.set('path', m[1]); }
    Object.assign(req, { query, url: `/api/iclock${url.search}` });
    const vres = Object.assign(res, {
      status(code: number) { res.statusCode = code; return vres; },
      send(b: string | Buffer) { res.end(b); return vres; },
    });
    handler(req as never, vres as never).catch((e: Error) => { res.statusCode = 500; res.end(e.message); });
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

test('the CRM records only its linked members, judged by their membership', async () => {
  const events = await list('accessEvents');
  expect(events.map((e) => e.fields.deviceUserId.stringValue).sort()).toEqual(['501', '502']);   // 999 isn't a CRM member
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

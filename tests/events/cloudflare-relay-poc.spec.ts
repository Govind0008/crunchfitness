import { test, expect } from '@playwright/test';
import http from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { FS, PROJECT, resetFirestore, seedDoc, ts } from './emulator';

// Cloudflare Workers POC: the production relay (api/iclock.ts, unchanged) running in Cloudflare's
// own runtime (workerd, via `wrangler dev`) with Firestore over REST. Same fake old server, same
// data and the same expectations as adms-relay-rules.spec.ts. Local only: nothing is deployed.
test.describe.configure({ mode: 'serial' });
const WRANGLER = join(process.cwd(), 'cloudflare/node_modules/.bin/wrangler');
test.skip(({ isMobile }) => isMobile, 'server-side, runs once');
test.skip(!existsSync(WRANGLER), 'cloudflare/ POC dependencies not installed (cd cloudflare && npm install)');

const SN = 'JJA1254700696';
const PORT = 8799;
let worker: ChildProcess;
let upstream: http.Server;
let upstreamDown = false;
const received: { method: string; url: string; body: string }[] = [];
const docUrl = (path: string) => `${FS}/v1/projects/${PROJECT}/databases/(default)/documents/${path}`;
const owner = { Authorization: 'Bearer owner' };
async function getDoc(path: string) {
  const r = await fetch(docUrl(path), { headers: owner });
  return r.ok ? ((await r.json()) as { fields: Record<string, { stringValue?: string; integerValue?: string; timestampValue?: string; nullValue?: null; arrayValue?: { values?: { stringValue: string }[] }; mapValue?: { fields: Record<string, { integerValue?: string }> } }> }).fields : null;
}
/** Documents in a collection, counted by Firestore itself (listing pages through results). */
async function count(parent: string, collectionId: string) {
  const r = await fetch(`${docUrl(parent)}:runAggregationQuery`, { method: 'POST', headers: { ...owner, 'Content-Type': 'application/json' }, body: JSON.stringify({ structuredAggregationQuery: { structuredQuery: { from: [{ collectionId }] }, aggregations: [{ alias: 'n', count: {} }] } }) });
  return Number(((await r.json()) as { result: { aggregateFields: { n: { integerValue: string } } } }[])[0].result.aggregateFields.n.integerValue);
}
async function list(path: string) {
  const r = await fetch(`${docUrl(path)}?pageSize=1000`, { headers: owner });
  return (((await r.json()) as { documents?: { name: string; fields: Record<string, { stringValue?: string }> }[] }).documents ?? []);
}
/** The Worker answers the device first and records afterwards (waitUntil): wait for the record. */
const recorded = (check: () => Promise<void>) => expect(check).toPass({ timeout: 20_000, intervals: [100, 250, 500, 1000] });
const send = (path: string, method = 'GET', body?: string) => fetch(`http://127.0.0.1:${PORT}/iclock/${path}`, { method, body, headers: body ? { 'Content-Type': 'text/plain' } : undefined });

test.beforeAll(async () => {
  test.setTimeout(120_000);
  await resetFirestore();
  upstream = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      if (upstreamDown) { req.socket.destroy(); return; }
      received.push({ method: req.method!, url: req.url!, body });
      const u = new URL(req.url!, 'http://x');
      u.pathname = u.pathname.replace(/\.aspx$/, '');
      res.setHeader('Content-Type', 'text/plain');
      if (u.pathname === '/iclock/cdata' && req.method === 'GET') res.end(`GET OPTION FROM: ${u.searchParams.get('SN')}\nATTLOGStamp=12345\nDelay=10`);
      else if (u.pathname === '/iclock/cdata') res.end(`OK: ${body.split('\n').filter(Boolean).length}`);
      else if (u.pathname === '/iclock/getrequest') res.end('C:77:INFO');
      else res.end('OK');
    });
  }).listen(0);
  await new Promise((r) => upstream.once('listening', r));
  await seedDoc('gyms/crunch-wakad/devices/dev1', { gymId: 'crunch-wakad', name: 'Main entrance', model: 'eSSL X2008', serialNumber: SN, protocol: 'adms', enabled: true, nextUserId: 1, lastSeenAt: null, lastSyncAt: null, firmware: null, lastError: null });
  await seedDoc('members/m1', { name: 'Asha Rao', phone: '9000000001', phoneKey: '9000000001', status: 'active', membershipEnd: '2099-12-31', activeUntil: '2099-12-31' });
  await seedDoc('members/m2', { name: 'Old Member', phone: '9000000002', phoneKey: '9000000002', status: 'active', membershipEnd: '2020-01-01', activeUntil: '2020-01-01' });
  await seedDoc('biometricIdentities/dev1_501', { gymId: 'crunch-wakad', memberId: 'm1', deviceId: 'dev1', deviceUserId: '501', method: 'fingerprint', status: 'PENDING', managedBy: 'crm', accessEnabled: true, enrollment: 'requested' });
  await seedDoc('biometricIdentities/dev1_502', { gymId: 'crunch-wakad', memberId: 'm2', deviceId: 'dev1', deviceUserId: '502', method: 'fingerprint', status: 'SYNCED' });   // old system
  const vars = {
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8085', GCLOUD_PROJECT: PROJECT,
    ADMS_UPSTREAM: `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`,
    // Local runtime can't open loopback TCP: plain fetch() here (the TCP path is proven on the edge, see PHASE_2_VALIDATION.md)
    ADMS_UPSTREAM_TCP: '0',
    ADMS_COMMAND_LISTEN: '0', ADMS_COMMAND_CHECK_MS: '0', ADMS_ROUTINE_RECORD_MS: '0', ADMS_HEARTBEAT_MS: '0',
    // Normal delivery, whatever wrangler.toml says: the safety switch (ADMS_DELIVER_CRM_COMMANDS=0) has its own spec
    ADMS_DELIVER_CRM_COMMANDS: '1',
  };
  worker = spawn(WRANGLER, ['dev', '--port', String(PORT), '--ip', '127.0.0.1', '--show-interactive-dev-session=false', ...Object.entries(vars).flatMap(([k, v]) => ['--var', `${k}:${v}`])], { cwd: join(process.cwd(), 'cloudflare'), env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } });
  worker.stderr?.on('data', (d) => { if (/error/i.test(String(d))) console.error('[wrangler]', String(d)); });
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`http://127.0.0.1:${PORT}/poc/health`)).ok) return; } catch { /* starting */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('wrangler dev did not start');
});
test.afterAll(async () => { worker?.kill(); upstream?.close(); });

test('handshake: forwarded unchanged; the old server’s answer reaches the device; contact recorded over REST', async () => {
  const hs = await send(`cdata.aspx?SN=${SN}&options=all&pushver=2.4.1`);
  expect(await hs.text()).toContain('ATTLOGStamp=12345');
  expect(received.at(-1)!.url).toBe(`/iclock/cdata.aspx?SN=${SN}&options=all&pushver=2.4.1`);
  await recorded(async () => {
    const diag = (await getDoc(`admsDiagnostics/${SN}`))!;
    expect(diag.pushVersion.stringValue).toBe('2.4.1');
    expect(diag.firstSeenAt.timestampValue).toBeTruthy();                           // serverTimestamp transform
    expect(Number(diag.counts.mapValue!.fields.handshake.integerValue)).toBe(1);     // transaction read-modify-write
  });
});

test('punches: acknowledged only by the old server; CRM, legacy and unknown users each recorded correctly', async () => {
  const attlog = '501\t2026-09-29 18:05:10\t0\t1\t0\t0\n999\t2026-09-29 18:06:00\t0\t1\t0\t0\n502\t2026-09-29 18:07:00\t0\t4\t0\t0\n';
  const up = await send(`cdata.aspx?SN=${SN}&table=ATTLOG&Stamp=12346`, 'POST', attlog);
  expect(await up.text()).toBe('OK: 3');
  expect(received.at(-1)!.body).toBe(attlog);                                       // byte for byte
  await recorded(async () => { expect((await getDoc('checkins/2026-09-29_m1'))?.eventIds).toBeTruthy(); expect((await list('accessEvents')).length).toBe(3); });
  const events = (await list('accessEvents')).map((d) => d.fields);
  expect(events.map((e) => e.deviceUserId.stringValue).sort()).toEqual(['501', '502', '999']);
  const by = (u: string) => events.find((e) => e.deviceUserId.stringValue === u)! as Record<string, { stringValue?: string }>;
  expect(by('501').decision.stringValue).toBe('ACCESS_ALLOWED');
  expect(by('502').decision.stringValue).toBe('LEGACY_USER');                       // old-system user: never denied
  expect(by('999').decision.stringValue).toBe('UNKNOWN_USER');                      // unknown: never denied
  const visit = (await getDoc('checkins/2026-09-29_m1'))!;                          // transaction + arrayUnion + Timestamp
  expect(visit.eventIds.arrayValue!.values!.length).toBe(1);
  await recorded(async () => {
    expect((await getDoc('biometricIdentities/dev1_501'))!.enrollment.stringValue).toBe('confirmed');
    expect((await getDoc('members/m1'))!.lastVisitAt.timestampValue).toMatch(/^2026-09-29T12:35:10/);
  });
  expect(await list('gyms/crunch-wakad/devices/dev1/commands')).toEqual([]);         // nothing sent to the device
  // The same upload again (a device retry) changes nothing
  await send(`cdata.aspx?SN=${SN}&table=ATTLOG&Stamp=12346`, 'POST', attlog);
  await new Promise((res) => setTimeout(res, 1500));                                // let the repeat's recording finish
  expect((await getDoc('checkins/2026-09-29_m1'))!.eventIds.arrayValue!.values!.length).toBe(1);
  expect((await list('accessEvents')).length).toBe(3);
});

test('user list: names recorded (merge), fingerprint templates never stored', async () => {
  const oplog = 'USER PIN=601\tName=RAVI K\tPri=0\tPasswd=\tCard=\tGrp=1\nFP PIN=601\tFID=6\tSize=1000\tValid=1\tTMP=AAAA\nUSER PIN=602\tName=Admin\tPri=14\n';
  await send(`cdata.aspx?SN=${SN}&table=OPERLOG&Stamp=5`, 'POST', oplog);
  expect(received.at(-1)!.body).toBe(oplog);
  await recorded(async () => expect((await list('gyms/crunch-wakad/devices/dev1/deviceUsers')).length).toBe(2));
  const users = await list('gyms/crunch-wakad/devices/dev1/deviceUsers');
  expect(users.map((u) => u.fields.name.stringValue).sort()).toEqual(['Admin', 'RAVI K']);
  expect(JSON.stringify(users)).not.toContain('TMP');
});

test('commands: the old server’s kept, ours added in the reserved range; results split; Return=0 → done', async () => {
  await seedDoc('biometricIdentities/dev1_10061', { gymId: 'crunch-wakad', memberId: 'm1', deviceId: 'dev1', deviceUserId: '10061', method: 'fingerprint', status: 'PENDING', managedBy: 'crm', accessEnabled: true, enrollment: 'not_enrolled' });
  await seedDoc('gyms/crunch-wakad/devices/dev1/commands/c1', { type: 'add_user', deviceUserId: '10061', name: 'Riya\tNew', status: 'queued', createdBy: 'x' });
  const poll = await (await send(`getrequest.aspx?SN=${SN}`)).text();
  expect(poll).toContain('C:77:INFO');
  const ours = poll.split('\n').find((l) => l.startsWith('C:9'))!;
  expect(ours).toMatch(/^C:9\d{8}:DATA UPDATE USERINFO PIN=10061\tName=Riya New\t/);
  expect((await getDoc('gyms/crunch-wakad/devices/dev1/commands/c1'))!.status.stringValue).toBe('sent');
  const id = ours.split(':')[1];
  const before = received.length;
  await send(`devicecmd.aspx?SN=${SN}`, 'POST', `ID=${id}&Return=0&CMD=DATA\nID=77&Return=0&CMD=INFO\n`);
  expect(received.length).toBe(before + 1);
  expect(received.at(-1)!.body).toBe('ID=77&Return=0&CMD=INFO\n');                  // only theirs goes to the old server
  expect((await getDoc('gyms/crunch-wakad/devices/dev1/commands/c1'))!.status.stringValue).toBe('done');
});

test('Open Door: sent as AC_UNLOCK, done on Return=0; a stale one expires and is never sent', async () => {
  await seedDoc('gyms/crunch-wakad/devices/dev1/commands/u1', { type: 'unlock_door', status: 'queued', createdBy: 'x', createdAt: ts(new Date().toISOString()) });
  const line = (await (await send(`getrequest.aspx?SN=${SN}`)).text()).split('\n').find((l) => l.endsWith(':AC_UNLOCK'))!;
  expect(line).toMatch(/^C:9\d{8}:AC_UNLOCK$/);
  await send(`devicecmd.aspx?SN=${SN}`, 'POST', `ID=${line.split(':')[1]}&Return=0&CMD=AC_UNLOCK\n`);
  expect((await getDoc('gyms/crunch-wakad/devices/dev1/commands/u1'))!.status.stringValue).toBe('done');
  expect((await list('activity')).some((a) => JSON.stringify(a.fields).includes('DOOR_UNLOCKED'))).toBe(true);
  await seedDoc('gyms/crunch-wakad/devices/dev1/commands/u2', { type: 'unlock_door', status: 'queued', createdBy: 'x', createdAt: ts(new Date(Date.now() - 120_000).toISOString()) });
  expect(await (await send(`getrequest.aspx?SN=${SN}`)).text()).not.toContain('AC_UNLOCK');
  expect((await getDoc('gyms/crunch-wakad/devices/dev1/commands/u2'))!.status.stringValue).toBe('failed');
});

test('old server down: the device is told to retry (503) and the error shows; the next good request clears it', async () => {
  upstreamDown = true;
  expect((await send(`getrequest.aspx?SN=${SN}`)).status).toBe(503);
  upstreamDown = false;
  expect((await getDoc('gyms/crunch-wakad/devices/dev1'))!.lastError.stringValue).toContain('didn’t answer');
  await send(`getrequest.aspx?SN=${SN}`);
  await recorded(async () => expect((await getDoc('gyms/crunch-wakad/devices/dev1'))!.lastError).toEqual({ nullValue: null }));
});

test('528-user list: answered at once with the old server’s reply; mirrored 100 per request; nothing lost; templates never stored', async () => {
  const tmp = 'A'.repeat(1400);   // a template-sized field (never stored)
  const lines: string[] = [];
  for (let i = 1; i <= 528; i++) {
    lines.push(`USER PIN=${2000 + i}\tName=MEMBER ${i}\tPri=0\tPasswd=\tCard=\tGrp=1\tTZ=0000000100000000\tVerify=0`);
    lines.push(`FP PIN=${2000 + i}\tFID=6\tSize=1000\tValid=1\tTMP=${tmp}`);
  }
  const body = lines.join('\n') + '\n';
  const t0 = Date.now();
  const r = await send(`cdata.aspx?SN=${SN}&table=OPERLOG&Stamp=9`, 'POST', body);
  const ms = Date.now() - t0;
  expect(r.status).toBe(200);
  expect(await r.text()).toBe(`OK: ${lines.length}`);                                // the old server's own acknowledgement
  expect(received.at(-1)!.body.length).toBe(body.length);                           // it got all of it
  await recorded(async () => {
    expect(await count('gyms/crunch-wakad/devices/dev1', 'deviceUsers')).toBe(2 + 100);   // first chunk…
    expect((await getDoc('gyms/crunch-wakad/devices/dev1/userBacklog/pending'))!.users.arrayValue!.values!.length).toBe(428);
  });
  for (let i = 0; i < 5; i++) { await send(`getrequest.aspx?SN=${SN}`); await new Promise((res) => setTimeout(res, 700)); }   // …the rest on the next polls
  await recorded(async () => expect(await count('gyms/crunch-wakad/devices/dev1', 'deviceUsers')).toBe(2 + 528));
  expect(await getDoc('gyms/crunch-wakad/devices/dev1/userBacklog/pending')).toBeNull();
  expect((await getDoc('gyms/crunch-wakad/devices/dev1'))!.usersSeenAt.timestampValue).toBeTruthy();
  expect(JSON.stringify(await list('gyms/crunch-wakad/devices/dev1/deviceUsers'))).not.toContain('AAAA');
  console.log(`[poc] 528-user upload (${(body.length / 1024).toFixed(0)} KiB) answered in ${ms} ms wall time`);
});

test('repeats change nothing: same user list, same punch, same command result, same heartbeat', async () => {
  // A CRM user already confirmed: a repeated upload with their fingerprint keeps the original enrolment time
  const before = (await getDoc('biometricIdentities/dev1_501'))!;
  await send(`cdata.aspx?SN=${SN}&table=OPERLOG&Stamp=10`, 'POST', 'USER PIN=501\tName=ASHA\tPri=0\nFP PIN=501\tFID=6\tSize=1000\tValid=1\tTMP=AAAA\n');
  await send(`cdata.aspx?SN=${SN}&table=OPERLOG&Stamp=10`, 'POST', 'USER PIN=501\tName=ASHA\tPri=0\nFP PIN=501\tFID=6\tSize=1000\tValid=1\tTMP=AAAA\n');
  await new Promise((res) => setTimeout(res, 1500));
  const after = (await getDoc('biometricIdentities/dev1_501'))!;
  expect(after.enrollment.stringValue).toBe('confirmed');
  expect(JSON.stringify(after.enrolledAt ?? null)).toBe(JSON.stringify(before.enrolledAt ?? null));
  const confirmations = (await list('activity')).filter((a) => JSON.stringify(a.fields).includes('ENROLLMENT_CONFIRMED') && JSON.stringify(a.fields).includes('"501"')).length;
  expect(confirmations).toBeLessThanOrEqual(1);
  // Same punch twice: one access event, one visit
  const punch = '501\t2026-09-30 07:00:00\t0\t1\t0\t0\n';
  await send(`cdata.aspx?SN=${SN}&table=ATTLOG&Stamp=20`, 'POST', punch);
  await recorded(async () => expect((await getDoc('checkins/2026-09-30_m1'))?.eventIds).toBeTruthy());
  await send(`cdata.aspx?SN=${SN}&table=ATTLOG&Stamp=20`, 'POST', punch);
  await new Promise((res) => setTimeout(res, 1500));
  expect((await list('accessEvents')).filter((e) => e.fields.localDate?.stringValue === '2026-09-30').length).toBe(1);
  expect((await getDoc('checkins/2026-09-30_m1'))!.eventIds.arrayValue!.values!.length).toBe(1);
  expect((await list('members')).length).toBe(2);                                   // no member ever created by the relay
  // Same command result twice: still done, one "door released" entry
  await seedDoc('gyms/crunch-wakad/devices/dev1/commands/u9', { type: 'unlock_door', status: 'queued', createdBy: 'x', createdAt: ts(new Date().toISOString()) });
  const line = (await (await send(`getrequest.aspx?SN=${SN}`)).text()).split('\n').find((l) => l.endsWith(':AC_UNLOCK'))!;
  const doors = async () => (await list('activity')).filter((a) => JSON.stringify(a.fields).includes('DOOR_UNLOCKED')).length;
  const d0 = await doors();
  await send(`devicecmd.aspx?SN=${SN}`, 'POST', `ID=${line.split(':')[1]}&Return=0&CMD=AC_UNLOCK\n`);
  await send(`devicecmd.aspx?SN=${SN}`, 'POST', `ID=${line.split(':')[1]}&Return=0&CMD=AC_UNLOCK\n`);
  expect((await getDoc('gyms/crunch-wakad/devices/dev1/commands/u9'))!.status.stringValue).toBe('done');
  expect(await doors()).toBe(d0 + 1);                                               // recorded once, not per repeat
  // Same command never sent twice
  const again = await (await send(`getrequest.aspx?SN=${SN}`)).text();
  expect(again).not.toContain('AC_UNLOCK');
});

test('two punch uploads at once for the same member and day: the transaction retries, no visit is lost', async () => {
  const a = '501\t2026-10-01 07:00:00\t0\t1\t0\t0\n', b = '501\t2026-10-01 19:00:00\t0\t1\t0\t0\n';
  await Promise.all([send(`cdata.aspx?SN=${SN}&table=ATTLOG&Stamp=30`, 'POST', a), send(`cdata.aspx?SN=${SN}&table=ATTLOG&Stamp=31`, 'POST', b)]);
  await recorded(async () => expect((await getDoc('checkins/2026-10-01_m1'))?.eventIds?.arrayValue?.values?.length).toBe(2));
});

test('malformed upload: still forwarded and answered; nothing recorded from garbage', async () => {
  const junk = 'not a punch\n\t\t\n999999999999\tnot-a-date\n';
  const before = (await list('accessEvents')).length;
  const r = await send(`cdata.aspx?SN=${SN}&table=ATTLOG&Stamp=40`, 'POST', junk);
  expect(r.status).toBe(200);
  expect(received.at(-1)!.body).toBe(junk);
  await new Promise((res) => setTimeout(res, 1500));
  expect((await list('accessEvents')).length).toBe(before);
});

test('service-account token (Web Crypto RS256): valid JWT, cached, refreshed after expiry', async () => {
  const { generateKeyPairSync, createVerify } = await import('node:crypto');
  const { accessToken } = await import('../../cloudflare/src/google-auth');
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  let issued = 0; let lastAssertion = '';
  const tokenServer = http.createServer((req, res) => {
    let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => {
      lastAssertion = new URLSearchParams(b).get('assertion') ?? '';
      issued++; res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ access_token: `t${issued}`, expires_in: 301 }));   // valid ~1 s after the 5-minute margin
    });
  }).listen(0);
  await new Promise((r) => tokenServer.once('listening', r));
  const sa = { client_email: 'poc@test.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(), token_uri: `http://127.0.0.1:${(tokenServer.address() as AddressInfo).port}/token` };
  expect(await accessToken(sa)).toBe('t1');
  expect(await accessToken(sa)).toBe('t1');                                         // cached: no new signature
  const [h, c, sig] = lastAssertion.split('.');
  expect(createVerify('RSA-SHA256').update(`${h}.${c}`).verify(publicKey, Buffer.from(sig, 'base64url'))).toBe(true);
  expect(JSON.parse(Buffer.from(c, 'base64url').toString()).scope).toBe('https://www.googleapis.com/auth/datastore');
  await new Promise((r) => setTimeout(r, 1200));
  expect(await accessToken(sa)).toBe('t2');                                         // expired → refreshed
  expect(issued).toBe(2);
  tokenServer.close();
});

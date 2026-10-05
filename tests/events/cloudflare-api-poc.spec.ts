import { test, expect } from '@playwright/test';
import http from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { ADMIN, AUTH, FS, PROJECT, ensureUser, resetFirestore, seedAdmin, seedDoc, ts } from './emulator';

// Cloudflare Workers: /api/adms (admin auth without the Admin SDK), the Open-door notify lane,
// /api/instagram and the sitemap — in Cloudflare's runtime (wrangler dev), local only.
// This Worker runs with a 10-minute periodic command check, so only the notify lane can explain
// a command reaching the device on the next poll.
test.describe.configure({ mode: 'serial' });
const WRANGLER = join(process.cwd(), 'cloudflare/node_modules/.bin/wrangler');
test.skip(({ isMobile }) => isMobile, 'server-side, runs once');
test.skip(!existsSync(WRANGLER), 'cloudflare/ POC dependencies not installed (cd cloudflare && npm install)');

const SN = 'CFAPI0001';
const PORT = 8797;
const W = `http://127.0.0.1:${PORT}`;
let worker: ChildProcess;
let upstream: http.Server;
const docUrl = (path: string) => `${FS}/v1/projects/${PROJECT}/databases/(default)/documents/${path}`;
async function getDoc(path: string) {
  const r = await fetch(docUrl(path), { headers: { Authorization: 'Bearer owner' } });
  return r.ok ? ((await r.json()) as { fields: Record<string, { stringValue?: string }> }).fields : null;
}
const idToken = async (email: string, password = 'crunch-test-pass') => (await (await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-key`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) })).json()).idToken as string;
const api = (qs: string, init: RequestInit = {}) => fetch(`${W}/api/adms?${qs}`, init);
const poll = () => fetch(`${W}/iclock/getrequest.aspx?SN=${SN}`).then((r) => r.text());

test.beforeAll(async () => {
  test.setTimeout(120_000);
  await resetFirestore();
  await seedAdmin();
  await ensureUser('cf-staff@crunch.test');                                          // signed in, but no admin role
  await seedDoc('gyms/crunch-wakad/devices/devA', { gymId: 'crunch-wakad', name: 'Main entrance', model: 'eSSL X2008', serialNumber: SN, protocol: 'adms', enabled: true, nextUserId: 1, lastSeenAt: null, lastSyncAt: null, firmware: null, lastError: null });
  upstream = http.createServer((req, res) => { req.resume(); req.on('end', () => { res.setHeader('Content-Type', 'text/plain'); res.end(req.url!.includes('getrequest') ? 'OK' : `GET OPTION FROM: ${SN}\nDelay=10`); }); }).listen(0);
  await new Promise((r) => upstream.once('listening', r));
  const vars = {
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8085', FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099', GCLOUD_PROJECT: PROJECT,
    ADMS_UPSTREAM: `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`, ADMS_UPSTREAM_TCP: '0',
    ADMS_COMMAND_LISTEN: '0', ADMS_COMMAND_CHECK_MS: '600000', ADMS_ROUTINE_RECORD_MS: '0', ADMS_HEARTBEAT_MS: '0',
  };
  worker = spawn(WRANGLER, ['dev', '--port', String(PORT), '--ip', '127.0.0.1', '--show-interactive-dev-session=false', ...Object.entries(vars).flatMap(([k, v]) => ['--var', `${k}:${v}`])], { cwd: join(process.cwd(), 'cloudflare'), env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } });
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`${W}/poc/health`)).ok) return; } catch { /* starting */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('wrangler dev did not start');
});
test.afterAll(async () => { worker?.kill(); upstream?.close(); });

test('/api/adms health is public and reveals nothing sensitive; everything else needs an admin', async () => {
  const h = await (await api('check=health')).json() as Record<string, unknown>;
  expect(h.alive).toBe(true);
  expect(h.recording).toBe(true);
  expect(JSON.stringify(h)).not.toMatch(/private_key|BEGIN|token/i);
  expect((await api('check=status')).status).toBe(401);                                         // no token
  const staff = await idToken('cf-staff@crunch.test');
  expect((await api('check=status', { headers: { Authorization: `Bearer ${staff}` } })).status).toBe(401);   // signed in, not an admin
  // A forged token: claims to be the admin, wrong project
  const forged = `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ aud: 'someone-else', iss: 'https://securetoken.google.com/someone-else', sub: 'x', exp: 9999999999, iat: 1 })).toString('base64url')}.`;
  expect((await api('check=status', { headers: { Authorization: `Bearer ${forged}` } })).status).toBe(401);
  expect((await api('check=notify&device=devA', { method: 'POST' })).status).toBe(401);       // notify is admin-only too
});

test('/api/adms for an admin: status, attendance check; bad input refused', async () => {
  const admin = await idToken(ADMIN.email, ADMIN.password);
  const auth = { headers: { Authorization: `Bearer ${admin}` } };
  await poll();                                                                                // the device has made contact
  await expect(async () => {                                                                   // recorded just after the reply (waitUntil)
    const status = await (await api('check=status', auth)).json() as { devices: { id: string }[]; contacts: { sn: string }[] };
    expect(status.devices.map((d) => d.id)).toContain('devA');
    expect(status.contacts.map((c) => c.sn)).toContain(SN);
  }).toPass({ timeout: 15_000 });
  const rec = await api('check=reconcile&from=2026-10-01&to=2026-10-05', auth);
  expect(rec.status).toBe(200);
  expect((await rec.json() as { eventsChecked: number }).eventsChecked).toBeGreaterThanOrEqual(0);
  expect((await api('check=reconcile&from=2026-01-01&to=2026-12-31', auth)).status).toBe(400);   // > 3 months
  expect((await api('check=notify&device=../../etc', { method: 'POST', ...auth })).status).toBe(400);
});

test('Open door: with notify it reaches the device on the next poll; without it, it waits for the periodic check', async () => {
  const admin = await idToken(ADMIN.email, ADMIN.password);
  for (let i = 0; i < 3; i++) await poll();                                                    // the periodic check has just run
  await seedDoc('gyms/crunch-wakad/devices/devA/commands/d1', { type: 'unlock_door', status: 'queued', createdBy: ADMIN.email, createdAt: ts(new Date().toISOString()) });
  expect(await poll()).not.toContain('AC_UNLOCK');                                              // no notify → not yet (10-min check)
  expect((await getDoc('gyms/crunch-wakad/devices/devA/commands/d1'))!.status.stringValue).toBe('queued');
  const n = await api('check=notify&device=devA', { method: 'POST', headers: { Authorization: `Bearer ${admin}` } });
  expect(n.status).toBe(200);
  const t0 = Date.now();
  const reply = await poll();                                                                  // the very next poll
  expect(reply).toMatch(/C:9\d{8}:AC_UNLOCK/);
  expect((await getDoc('gyms/crunch-wakad/devices/devA/commands/d1'))!.status.stringValue).toBe('sent');
  expect(await poll()).not.toContain('AC_UNLOCK');                                              // delivered once
  console.log(`[poc] notify → delivered on the next poll (${Date.now() - t0} ms after it)`);
  // A notify with nothing queued sends nothing and changes nothing
  await api('check=notify&device=devA', { method: 'POST', headers: { Authorization: `Bearer ${admin}` } });
  expect(await poll()).not.toContain('C:9');
});

test('a stale Open door is never sent, even when notified', async () => {
  const admin = await idToken(ADMIN.email, ADMIN.password);
  await seedDoc('gyms/crunch-wakad/devices/devA/commands/d2', { type: 'unlock_door', status: 'queued', createdBy: ADMIN.email, createdAt: ts(new Date(Date.now() - 60_000).toISOString()) });
  await api('check=notify&device=devA', { method: 'POST', headers: { Authorization: `Bearer ${admin}` } });
  expect(await poll()).not.toContain('AC_UNLOCK');
  expect((await getDoc('gyms/crunch-wakad/devices/devA/commands/d2'))!.status.stringValue).toBe('failed');
});

test('/api/instagram and the sitemap behave as on Vercel (cacheable answers)', async () => {
  const ig = await fetch(`${W}/api/instagram`);
  expect(ig.status).toBe(503);
  expect((await ig.json() as { reason: string }).reason).toBe('not_configured');
  expect(ig.headers.get('cache-control')).toMatch(/s-maxage=3600/);
  const sm = await fetch(`${W}/sitemap.xml`);
  expect(sm.status).toBe(200);
  expect(sm.headers.get('content-type')).toContain('application/xml');
  const xml = await sm.text();
  expect(xml).toContain('<urlset');
  expect(xml).toMatch(/<loc>https:\/\/[^<]+<\/loc>/);
});

test('ID-token verification (no Admin SDK): Google’s real keys; forged signature, wrong project, expiry all refused', async () => {
  const { verifyFirebaseIdToken } = await import('../../cloudflare/src/admin-auth');
  const saved = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  delete process.env.FIREBASE_AUTH_EMULATOR_HOST;                                               // production mode
  try {
    const kids = Object.keys(await (await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com')).json());
    const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const claims = { aud: 'crunch-fitness-blog', iss: 'https://securetoken.google.com/crunch-fitness-blog', sub: 'u1', iat: Math.floor(Date.now() / 1000) - 10, exp: Math.floor(Date.now() / 1000) + 3000 };
    const forgedSig = `${enc({ alg: 'RS256', kid: kids[0] })}.${enc(claims)}.${Buffer.from('not a signature').toString('base64url')}`;
    await expect(verifyFirebaseIdToken(forgedSig, 'crunch-fitness-blog')).rejects.toThrow('Bad signature');
    await expect(verifyFirebaseIdToken(`${enc({ alg: 'none' })}.${enc(claims)}.`, 'crunch-fitness-blog')).rejects.toThrow('Unexpected token algorithm');   // unsigned refused outside the emulator
    await expect(verifyFirebaseIdToken(`${enc({ alg: 'RS256', kid: 'nope' })}.${enc(claims)}.x`, 'crunch-fitness-blog')).rejects.toThrow('Unknown signing key');
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';                                 // claim checks, isolated from signatures
    process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8085';                                     // (a pure emulator setup)
    await expect(verifyFirebaseIdToken(`${enc({ alg: 'none' })}.${enc({ ...claims, aud: 'other' })}.`, 'crunch-fitness-blog')).rejects.toThrow('Wrong audience');
    await expect(verifyFirebaseIdToken(`${enc({ alg: 'none' })}.${enc({ ...claims, exp: 1 })}.`, 'crunch-fitness-blog')).rejects.toThrow('Expired');
    await expect(verifyFirebaseIdToken(`${enc({ alg: 'none' })}.${enc({ ...claims, iss: 'https://evil' })}.`, 'crunch-fitness-blog')).rejects.toThrow('Wrong issuer');
    expect((await verifyFirebaseIdToken(`${enc({ alg: 'none' })}.${enc(claims)}.`, 'crunch-fitness-blog')).uid).toBe('u1');
    // With a production credential present, unsigned tokens are refused even if the emulator switch is on
    process.env.FIREBASE_SERVICE_ACCOUNT = '{"client_email":"x","private_key":"not-a-key"}';
    await expect(verifyFirebaseIdToken(`${enc({ alg: 'none' })}.${enc(claims)}.`, 'crunch-fitness-blog')).rejects.toThrow('Unexpected token algorithm');
    delete process.env.FIREBASE_SERVICE_ACCOUNT;
  } finally {
    if (saved === undefined) delete process.env.FIREBASE_AUTH_EMULATOR_HOST; else process.env.FIREBASE_AUTH_EMULATOR_HOST = saved;
  }
});

test('test settings next to production credentials: the Worker refuses to serve (503), never runs half-configured', async () => {
  test.setTimeout(120_000);
  const port = 8795;
  const w = spawn(WRANGLER, ['dev', '--port', String(port), '--ip', '127.0.0.1', '--show-interactive-dev-session=false',
    '--var', 'FIREBASE_SERVICE_ACCOUNT:{"client_email":"guard-test@example.iam.gserviceaccount.com","private_key":"not-a-real-key"}',
    '--var', 'FIREBASE_AUTH_EMULATOR_HOST:127.0.0.1:9099', '--var', 'ADMS_UPSTREAM:none'], { cwd: join(process.cwd(), 'cloudflare'), env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } });
  try {
    let up = false;
    for (let i = 0; i < 120 && !up; i++) {
      try { up = (await fetch(`http://127.0.0.1:${port}/api/adms?check=health`)).status > 0; } catch { await new Promise((r) => setTimeout(r, 500)); }
    }
    for (const path of ['/api/adms?check=health', '/api/adms?check=status', `/iclock/getrequest?SN=${SN}`, '/poc/health']) {
      const r = await fetch(`http://127.0.0.1:${port}${path}`);
      expect(r.status, path).toBe(503);
      const body = await r.json() as { error: string };
      expect(body.error).toContain('FIREBASE_AUTH_EMULATOR_HOST');
      expect(JSON.stringify(body)).not.toContain('not-a-real-key');                              // never echoes the credential
    }
  } finally { w.kill(); }
});

import { test, expect } from '@playwright/test';
import http from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { ADMIN, AUTH, FS, PROJECT, resetFirestore, seedAdmin, seedDoc, ts } from './emulator';

// Open door when staff and the device reach DIFFERENT Cloudflare locations (e.g. a phone on mobile
// data): the edge cache and instance memory can't carry the signal there, so the Worker runs with
// ADMS_SIGNAL_LOCAL=0 and only the device's Durable Object can. The periodic check is 10 minutes,
// so only the signal can explain a command reaching the device on the next poll. Local only.
test.describe.configure({ mode: 'serial' });
const WRANGLER = join(process.cwd(), 'cloudflare/node_modules/.bin/wrangler');
test.skip(({ isMobile }) => isMobile, 'server-side, runs once');
test.skip(!existsSync(WRANGLER), 'cloudflare/ POC dependencies not installed (cd cloudflare && npm install)');

const SN = 'CFSIG0001';
const PORT = 8796;
const W = `http://127.0.0.1:${PORT}`;
let worker: ChildProcess;
let upstream: http.Server;
const docUrl = (path: string) => `${FS}/v1/projects/${PROJECT}/databases/(default)/documents/${path}`;
async function status(path: string) {
  const r = await fetch(docUrl(path), { headers: { Authorization: 'Bearer owner' } });
  return ((await r.json()) as { fields: Record<string, { stringValue?: string }> }).fields.status.stringValue;
}
const idToken = async (email: string, password: string) => (await (await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-key`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) })).json()).idToken as string;
const notify = (token: string) => fetch(`${W}/api/adms?check=notify&device=devS`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
const poll = () => fetch(`${W}/iclock/getrequest.aspx?SN=${SN}`).then((r) => r.text());

test.beforeAll(async () => {
  test.setTimeout(120_000);
  await resetFirestore();
  await seedAdmin();
  await seedDoc('gyms/crunch-wakad/devices/devS', { gymId: 'crunch-wakad', name: 'Main entrance', model: 'eSSL X2008', serialNumber: SN, protocol: 'adms', enabled: true, nextUserId: 1, lastSeenAt: null, lastSyncAt: null, firmware: null, lastError: null });
  upstream = http.createServer((req, res) => { req.resume(); req.on('end', () => { res.setHeader('Content-Type', 'text/plain'); res.end('OK'); }); }).listen(0);
  await new Promise((r) => upstream.once('listening', r));
  const vars = {
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8085', FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099', GCLOUD_PROJECT: PROJECT,
    ADMS_UPSTREAM: `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`, ADMS_UPSTREAM_TCP: '0',
    ADMS_COMMAND_LISTEN: '0', ADMS_COMMAND_CHECK_MS: '600000', ADMS_ROUTINE_RECORD_MS: '0', ADMS_HEARTBEAT_MS: '0',
    ADMS_DELIVER_CRM_COMMANDS: '1', ADMS_SIGNAL_LOCAL: '0',
  };
  worker = spawn(WRANGLER, ['dev', '--port', String(PORT), '--ip', '127.0.0.1', '--show-interactive-dev-session=false', ...Object.entries(vars).flatMap(([k, v]) => ['--var', `${k}:${v}`])], { cwd: join(process.cwd(), 'cloudflare'), env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } });
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`${W}/poc/health`)).ok) return; } catch { /* starting */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('wrangler dev did not start');
});
test.afterAll(async () => { worker?.kill(); upstream?.close(); });

test('Open door from another Cloudflare location: the Durable Object carries the signal to the next poll, once', async () => {
  const admin = await idToken(ADMIN.email, ADMIN.password);
  for (let i = 0; i < 3; i++) await poll();                                                    // the periodic check has just run
  await seedDoc('gyms/crunch-wakad/devices/devS/commands/u1', { type: 'unlock_door', status: 'queued', createdBy: ADMIN.email, createdAt: ts(new Date().toISOString()) });
  expect(await poll()).not.toContain('AC_UNLOCK');                                              // no signal → not yet
  expect((await notify(admin)).status).toBe(200);
  expect(await poll()).toMatch(/C:9\d{8}:AC_UNLOCK/);                                           // the very next poll
  expect(await status('gyms/crunch-wakad/devices/devS/commands/u1')).toBe('sent');
  expect(await poll()).not.toContain('AC_UNLOCK');                                              // taken: delivered once

  // A second press straight after (the case that expired on 28 Oct) goes out just as fast
  await seedDoc('gyms/crunch-wakad/devices/devS/commands/u2', { type: 'unlock_door', status: 'queued', createdBy: ADMIN.email, createdAt: ts(new Date().toISOString()) });
  await notify(admin);
  expect(await poll()).toMatch(/C:9\d{8}:AC_UNLOCK/);
  expect(await status('gyms/crunch-wakad/devices/devS/commands/u2')).toBe('sent');
});

test('a signal with nothing queued sends nothing, and is used up', async () => {
  const admin = await idToken(ADMIN.email, ADMIN.password);
  await poll();                                                                                // after a delivery the next poll is a routine-check turn
  await notify(admin);
  expect(await poll()).not.toContain('C:9');
  // Queued later without a new signal: waits for the periodic check (the old signal is gone)
  await seedDoc('gyms/crunch-wakad/devices/devS/commands/u3', { type: 'unlock_door', status: 'queued', createdBy: ADMIN.email, createdAt: ts(new Date().toISOString()) });
  expect(await poll()).not.toContain('AC_UNLOCK');
  expect(await status('gyms/crunch-wakad/devices/devS/commands/u3')).toBe('queued');
});

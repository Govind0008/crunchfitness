import { test, expect } from '@playwright/test';
import http from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { ADMIN, AUTH, FS, PROJECT, resetFirestore, seedAdmin, seedDoc, ts } from './emulator';

// The relay in Cloudflare's runtime (wrangler dev) started with ADMS_DELIVER_CRM_COMMANDS=0, as it
// would be deployed for a controlled X2008 test: no CRM command reaches the device, the queue is
// left as it is, and the old server's commands still flow. Local only: nothing is deployed.
test.describe.configure({ mode: 'serial' });
const WRANGLER = join(process.cwd(), 'cloudflare/node_modules/.bin/wrangler');
test.skip(({ isMobile }) => isMobile, 'server-side, runs once');
test.skip(!existsSync(WRANGLER), 'cloudflare/ POC dependencies not installed (cd cloudflare && npm install)');

const SN = 'JJA1254700696';
const PORT = 8798;
let worker: ChildProcess;
let upstream: http.Server;
const received: { method: string; url: string; body: string }[] = [];
const docUrl = (path: string) => `${FS}/v1/projects/${PROJECT}/databases/(default)/documents/${path}`;
async function getDoc(path: string) {
  const r = await fetch(docUrl(path), { headers: { Authorization: 'Bearer owner' } });
  return r.ok ? ((await r.json()) as { fields: Record<string, { stringValue?: string }> }).fields : null;
}
const send = (path: string, method = 'GET', body?: string) => fetch(`http://127.0.0.1:${PORT}/iclock/${path}`, { method, body, headers: body ? { 'Content-Type': 'text/plain' } : undefined });

test.beforeAll(async () => {
  test.setTimeout(120_000);
  await resetFirestore();
  await seedAdmin();
  upstream = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      received.push({ method: req.method!, url: req.url!, body });
      res.setHeader('Content-Type', 'text/plain');
      res.end(req.url!.startsWith('/iclock/getrequest') ? 'C:77:INFO' : 'OK');
    });
  }).listen(0);
  await new Promise((r) => upstream.once('listening', r));
  await seedDoc('gyms/crunch-wakad/devices/dev1', { gymId: 'crunch-wakad', name: 'Main entrance', model: 'eSSL X2008', serialNumber: SN, protocol: 'adms', enabled: true, nextUserId: 1, lastSeenAt: null, lastSyncAt: null, firmware: null, lastError: null });
  const vars = {
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8085', FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099', GCLOUD_PROJECT: PROJECT,
    ADMS_UPSTREAM: `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`, ADMS_UPSTREAM_TCP: '0',
    ADMS_COMMAND_LISTEN: '0', ADMS_COMMAND_CHECK_MS: '0', ADMS_ROUTINE_RECORD_MS: '0', ADMS_HEARTBEAT_MS: '0',
    ADMS_DELIVER_CRM_COMMANDS: '0',
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

test('switch off: polls carry only the old server’s commands; Open Door, add user, enrolment and user-list requests stay queued', async () => {
  const fresh = ts(new Date().toISOString());
  const ids = ['k1', 'k2', 'k3', 'k4'];
  await seedDoc('gyms/crunch-wakad/devices/dev1/commands/k1', { type: 'unlock_door', status: 'queued', createdBy: 'x', createdAt: fresh });
  await seedDoc('gyms/crunch-wakad/devices/dev1/commands/k2', { type: 'add_user', deviceUserId: '10081', name: 'Switch Test', status: 'queued', createdBy: 'x', createdAt: fresh });
  await seedDoc('gyms/crunch-wakad/devices/dev1/commands/k3', { type: 'enroll_fp', deviceUserId: '10081', status: 'queued', createdBy: 'x', createdAt: fresh });
  await seedDoc('gyms/crunch-wakad/devices/dev1/commands/k4', { type: 'query_users', status: 'queued', createdBy: 'x', createdAt: fresh });
  // A staff "Open door" signal (the notify lane) must not bring anything out either
  const admin = (await (await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-key`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...ADMIN, returnSecureToken: true }) })).json()).idToken as string;
  expect((await fetch(`http://127.0.0.1:${PORT}/api/adms?check=notify&device=dev1`, { method: 'POST', headers: { Authorization: `Bearer ${admin}` } })).ok).toBe(true);
  for (let i = 0; i < 4; i++) {
    const before = received.length;
    expect(await (await send(`getrequest.aspx?SN=${SN}`)).text()).toBe('C:77:INFO');
    expect(received.at(before)!.url).toBe(`/iclock/getrequest.aspx?SN=${SN}`);
  }
  await send(`devicecmd.aspx?SN=${SN}`, 'POST', 'ID=77&Return=0&CMD=INFO\n');
  expect(received.at(-1)!.body).toBe('ID=77&Return=0&CMD=INFO\n');                   // old-server results unchanged
  await new Promise((r) => setTimeout(r, 1500));                                      // let waitUntil recordings finish
  for (const id of ids) {
    const d = (await getDoc(`gyms/crunch-wakad/devices/dev1/commands/${id}`))!;
    expect(d.status.stringValue).toBe('queued');
    expect(d.commandId).toBeUndefined();
    expect(d.sentAt).toBeUndefined();
  }
});

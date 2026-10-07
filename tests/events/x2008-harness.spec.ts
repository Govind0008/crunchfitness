import { test, expect } from '@playwright/test';
import { execFile, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FS, PROJECT, resetFirestore, seedDoc, ts } from './emulator';

// The X2008 test harness (cloudflare/x2008/harness.ts) against the Firestore emulator, with saved
// Worker-log fixtures in place of `wrangler tail`: its guards refuse every write and every /iclock
// call, it never changes anything it reads, and its PASS/FAIL verdicts follow the runbook.
test.describe.configure({ mode: 'serial' });
test.skip(({ isMobile }) => isMobile, 'server-side, runs once');

const SN = 'JJA1254700696';
const VERSION = '95c25fe6-c069-481f-a85e-5a93819f7adb';
const CF = join(process.cwd(), 'cloudflare');
const HARNESS = join(CF, 'x2008/harness.mjs');
const dir = mkdtempSync(join(tmpdir(), 'x2008-harness-'));
const env = { ...process.env, FIRESTORE_EMULATOR_HOST: '127.0.0.1:8085', GCLOUD_PROJECT: PROJECT, X2008_RUNS_DIR: join(dir, 'runs') };
const docs = `${FS}/v1/projects/${PROJECT}/databases/(default)/documents`;
const owner = { Authorization: 'Bearer owner' };

function harness(...args: string[]): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => execFile('node', [HARNESS, ...args, '--emulator'], { env, timeout: 60_000 }, (e, stdout, stderr) => resolve({ code: e ? (e as { code?: number }).code ?? 1 : 0, out: stdout + stderr })));
}
/** A Worker log as `wrangler tail --format json` writes it: pretty-printed objects back to back. */
function tail(name: string, events: object[]) {
  const f = join(dir, `${name}.jsonl`);
  writeFileSync(f, events.map((e) => JSON.stringify(e, null, 4)).join('\n'));
  return f;
}
function ev(t: number, path: string, o: { method?: string; http?: number; upstream?: number | null; kind?: string; note?: string; outcome?: string; sn?: string; cmds?: string[] } = {}) {
  const relay = { adms: true, kind: o.kind ?? (path.startsWith('getrequest') ? 'command poll' : 'handshake'), status: o.http ?? 200, upstreamStatus: o.upstream === undefined ? 200 : o.upstream, ...(o.note ? { note: o.note } : {}), ...(o.cmds ? { upstreamCommands: o.cmds } : {}) };
  return {
    wallTime: 30, cpuTime: 1, outcome: o.outcome ?? 'ok', scriptVersion: { id: VERSION }, exceptions: [], eventTimestamp: t,
    logs: [{ level: 'log', timestamp: t, message: [JSON.stringify(relay)] }, { level: 'log', timestamp: t, message: [JSON.stringify({ adms: true, kind: 'firestore usage', requests: {} })] }],
    event: { request: { url: `https://crunch-site.gsalunke169.workers.dev/iclock/${path}${path.includes('?') ? '&' : '?'}SN=${o.sn ?? SN}`, method: o.method ?? 'GET', headers: { 'cf-visitor': '{"scheme":"https"}', 'user-agent': 'iClock Proxy/1.09' } }, response: { status: o.http ?? 200 } },
  };
}
const goodRun = (t0 = Date.now()) => [
  { outcome: 'ok', eventTimestamp: t0 - 1000, event: { request: { url: 'https://crunch-site.gsalunke169.workers.dev/api/adms?check=health', method: 'GET' }, response: { status: 200 } }, logs: [], exceptions: [], scriptVersion: { id: VERSION } },
  ev(t0, 'cdata.aspx?options=all&pushver=2.4.1'),
  ...Array.from({ length: 120 }, (_, i) => ev(t0 + 2000 + i * 3600, 'getrequest.aspx')),
];
async function snapshot() {
  const get = async (p: string) => (await (await fetch(`${docs}/${p}`, { headers: owner })).json()) as unknown;
  const roots = await (await fetch(`${docs}:listCollectionIds`, { method: 'POST', headers: { ...owner, 'Content-Type': 'application/json' }, body: '{}' })).json();
  return JSON.stringify([await get('gyms/crunch-wakad/devices/dev1'), await get(`admsDiagnostics/${SN}`), await get('gyms/crunch-wakad/devices/dev1/commands'), roots]);
}
const diag = (lastSeen: Date) => seedDoc(`admsDiagnostics/${SN}`, {
  sn: SN, lastSeenAt: ts(lastSeen.toISOString()), pushVersion: '2.4.1', lastUserAgent: 'iClock Proxy/1.09',
  last: { kind: 'command poll', status: 200, upstreamStatus: 200 }, counts: { 'command poll': 1000, handshake: 3 },
  recent: [{ kind: 'command poll', status: 200, upstreamStatus: 200 }, { kind: 'command poll', status: 200, upstreamStatus: 200, upstreamCommands: ['INFO ×1'] }],
});
const queue = (id: string, type = 'unlock_door') => seedDoc(`gyms/crunch-wakad/devices/dev1/commands/${id}`, { type, status: 'queued', createdBy: 'x', createdAt: ts(new Date().toISOString()) });
const unqueue = (id: string) => fetch(`${docs}/gyms/crunch-wakad/devices/dev1/commands/${id}`, { method: 'DELETE', headers: owner });

test.beforeAll(async () => {
  execFileSync(join(process.cwd(), 'node_modules/.bin/esbuild'), ['x2008/harness.ts', '--bundle', '--platform=node', '--format=esm', '--target=node22', '--outfile=x2008/harness.mjs', '--log-level=warning'], { cwd: CF });
  await resetFirestore();
  await seedDoc('gyms/crunch-wakad/devices/dev1', { gymId: 'crunch-wakad', name: 'Main entrance', serialNumber: SN, protocol: 'adms', enabled: true, lastSeenAt: ts(new Date(Date.now() - 60_000).toISOString()), lastError: null });
  await diag(new Date(Date.now() - 60_000));
});

test('preflight: guards refuse every write and every /iclock call; a clean queue passes; nothing it reads is changed', async () => {
  const before = await snapshot();
  const r = await harness('preflight');
  expect(r.out).toMatch(/PASS\s+Guard blocks \/iclock on workers\.dev/);
  expect(r.out).toMatch(/PASS\s+Guard blocks \/iclock on the production domain/);
  expect(r.out).toMatch(/PASS\s+Guard blocks Firestore commit \(HTTP\)/);
  expect(r.out).toMatch(/PASS\s+Guard blocks Firestore client batch\(\)/);
  expect(r.out).not.toMatch(/FAIL\s+Guard/);
  expect(r.out).toMatch(/PASS\s+Queued CRM commands = 0/);
  expect(r.out).toMatch(/Baseline: old-server command verbs\s+INFO/);
  expect(r.out).toContain('RESULT: PASS');
  expect(r.code).toBe(0);
  expect(await snapshot()).toBe(before);   // not a field or timestamp changed, no collection created
});

test('preflight: a queued CRM command is a FAIL (and the command is left exactly as it was)', async () => {
  await queue('q1');
  const before = await snapshot();
  const r = await harness('preflight');
  expect(r.out).toMatch(/FAIL\s+Queued CRM commands = 0\s+q1:unlock_door/);
  expect(r.out).toContain('STOP: do not touch the X2008');
  expect(r.code).toBe(1);
  expect(await snapshot()).toBe(before);
  // The monitor refuses to run on a failed baseline
  const m = await harness('monitor', '--input', tail('empty', []));
  expect(m.out).toContain('preflight FAILED');
  expect(m.code).toBe(1);
  await unqueue('q1');
  expect((await harness('preflight')).code).toBe(0);   // a clean baseline for the tests below
});

// Production since the cut-over: www is the Worker's one Custom Domain on the active zone, the switch is on
const VERSION_NOW = 'f4cfcfc0-07a9-49f5-83be-bbee4870f4f6';
const facts = (change: Record<string, unknown> = {}) => ({
  versions: [{ version_id: VERSION_NOW, percentage: 100 }],
  bindings: [
    { name: 'ADMS_COMMAND_CHECK_MS', type: 'plain_text', text: '15000' }, { name: 'ADMS_COMMAND_LISTEN', type: 'plain_text', text: '0' },
    { name: 'ADMS_DELIVER_CRM_COMMANDS', type: 'plain_text', text: '0' }, { name: 'ADMS_UPSTREAM', type: 'plain_text', text: 'http://122.160.158.120:5072' },
    { name: 'ADMS_USER_CHUNK', type: 'plain_text', text: '100' }, { name: 'FIREBASE_SERVICE_ACCOUNT', type: 'secret_text', text: null },
  ],
  secrets: ['FIREBASE_SERVICE_ACCOUNT'],
  domains: [{ hostname: 'www.crunnchhfitness.com', service: 'crunch-site', environment: 'production' }],
  zone: { status: 'active' }, routes: [], errors: {}, ...change,
});
const withFacts = (name: string, f: object) => { const file = join(dir, `facts-${name}.json`); writeFileSync(file, JSON.stringify(f)); return harness('preflight', '--cloudflare-facts', file); };

test('preflight (Cloudflare): the production custom-domain setup with the safety switch passes every check', async () => {
  const r = await withFacts('good', facts());
  expect(r.out).toMatch(/PASS\s+Worker version f4cfcfc0… live at 100%/);
  expect(r.out).toMatch(/PASS\s+ADMS_DELIVER_CRM_COMMANDS = "0"/);
  expect(r.out).toMatch(/PASS\s+Exactly one custom domain: www\.crunnchhfitness\.com → crunch-site \(production\)/);
  expect(r.out).toMatch(/PASS\s+Zone crunnchhfitness\.com active/);
  expect(r.out).toMatch(/PASS\s+No Worker routes on the zone/);
  expect(r.out).toMatch(/PASS\s+Secrets = FIREBASE_SERVICE_ACCOUNT only/);
  expect(r.out).toContain('RESULT: PASS');
  expect(r.code).toBe(0);
});

test('preflight (Cloudflare): every unsafe or unexpected setup is a FAIL that stops the test', async () => {
  const bindings = facts().bindings;
  const cases: [string, Record<string, unknown>, RegExp][] = [
    ['switch-missing', { bindings: bindings.filter((b) => b.name !== 'ADMS_DELIVER_CRM_COMMANDS') }, /FAIL\s+ADMS_DELIVER_CRM_COMMANDS = "0"\s+"absent"/],
    ['switch-1', { bindings: bindings.map((b) => (b.name === 'ADMS_DELIVER_CRM_COMMANDS' ? { ...b, text: '1' } : b)) }, /FAIL\s+ADMS_DELIVER_CRM_COMMANDS = "0"\s+"1"/],
    ['old-version', { versions: [{ version_id: '6a833940-4f73-463c-a413-6b3796d3f151', percentage: 100 }] }, /FAIL\s+Worker version f4cfcfc0… live at 100%\s+6a833940/],
    ['split', { versions: [{ version_id: VERSION_NOW, percentage: 90 }, { version_id: '6a833940-4f73-463c-a413-6b3796d3f151', percentage: 10 }] }, /FAIL\s+Worker version f4cfcfc0… live at 100%/],
    ['no-domain', { domains: [] }, /FAIL\s+Exactly one custom domain.*none/],
    ['two-domains', { domains: [...facts().domains, { hostname: 'crunnchhfitness.com', service: 'crunch-site', environment: 'production' }] }, /FAIL\s+Exactly one custom domain/],
    ['other-host', { domains: [{ hostname: 'x2008-test.crunnchhfitness.com', service: 'crunch-site', environment: 'production' }] }, /FAIL\s+Exactly one custom domain/],
    ['zone-pending', { zone: { status: 'pending' } }, /FAIL\s+Zone crunnchhfitness\.com active.*status pending/],
    ['route', { routes: [{ pattern: 'www.crunnchhfitness.com/*' }] }, /FAIL\s+No Worker routes on the zone/],
    ['extra-secret', { secrets: ['FIREBASE_SERVICE_ACCOUNT', 'POC_PROBE_KEY'] }, /FAIL\s+Secrets = FIREBASE_SERVICE_ACCOUNT only/],
    ['emulator-var', { bindings: [...bindings, { name: 'FIRESTORE_EMULATOR_HOST', type: 'plain_text', text: 'x' }] }, /FAIL\s+No emulator settings on the Worker/],
    ['upstream', { bindings: bindings.map((b) => (b.name === 'ADMS_UPSTREAM' ? { ...b, text: 'http://example.com' } : b)) }, /FAIL\s+ADMS_UPSTREAM = old server/],
    ['unreadable', { errors: { zone: 'Authentication error' }, domains: undefined }, /FAIL\s+Domains \/ zone \/ routes readable/],
  ];
  for (const [name, change, line] of cases) {
    const r = await withFacts(name, facts(change));
    expect(r.out, name).toMatch(line);
    expect(r.out, name).toContain('RESULT: FAIL');
    expect(r.out, name).toContain('STOP: do not touch the X2008');
    expect(r.code, name).toBe(1);
  }
});

test('preflight: recorded Cloudflare facts are refused outside test mode (a real preflight always asks Cloudflare)', async () => {
  const file = join(dir, 'facts-good.json');
  const r = await new Promise<{ code: number; out: string }>((resolve) => execFile('node', [HARNESS, 'preflight', '--cloudflare-facts', file], { env, timeout: 60_000 }, (e, so, se) => resolve({ code: e ? (e as { code?: number }).code ?? 1 : 0, out: so + se })));
  expect(r.out).toMatch(/FAIL\s+Cloudflare facts from a file\s+--cloudflare-facts is for --emulator tests only/);
  expect(r.out).toMatch(/FAIL\s+Firestore readable\s+Refusing: [A-Z_, ]*FIRESTORE_EMULATOR_HOST[A-Z_, ]* set/);   // and production mode never reads a test database
  expect(r.code).toBe(1);
  expect((await harness('preflight')).code).toBe(0);   // a clean baseline again for the tests below
});

test('monitor: handshake and steady polling with 200/200 answers → PASS', async () => {
  await diag(new Date());   // the relay recorded the device during the test (as the Worker does)
  const r = await harness('monitor', '--input', tail('good', goodRun()));
  expect(r.out).toMatch(/PASS\s+First handshake through the Worker/);
  expect(r.out).toMatch(/PASS\s+Steady polling \(>= 100 polls\)\s+120 polls/);
  expect(r.out).toMatch(/PASS\s+Poll interval \(median <= 10 s\)\s+3\.6 s/);
  expect(r.out).toMatch(/PASS\s+CRM command queue unchanged/);
  expect(r.out).toContain('RESULT: PASS');
  expect(r.code).toBe(0);
});

test('monitor: a 503 or an old-server failure → FAIL; a new old-server command → REVIEW', async () => {
  const t0 = Date.now();
  const r = await harness('monitor', '--input', tail('bad', [...goodRun(t0), ev(t0 + 500_000, 'getrequest.aspx', { http: 503, upstream: null, note: 'old server unreachable: timeout' }), ev(t0 + 503_600, 'getrequest.aspx', { cmds: ['DATA DELETE USERINFO ×1'] })]));
  expect(r.out).toMatch(/FAIL\s+No 4xx\/5xx, exceptions or failed outcomes\s+1:.*http 503.*old server unreachable/);
  expect(r.out).toMatch(/REVIEW\s+Old-server commands as in the baseline\s+new: DATA DELETE USERINFO/);
  expect(r.out).toContain('RESULT: FAIL');
  expect(r.code).toBe(1);
});

test('monitor: the command queue changing during the test → FAIL', async () => {
  await queue('q2', 'add_user');
  const r = await harness('monitor', '--input', tail('good2', goodRun()));
  expect(r.out).toMatch(/FAIL\s+CRM command queue unchanged \(queued\/sent\)\s+.*queued \[q2\]/);
  expect(r.code).toBe(1);
  await unqueue('q2');
});

test('monitor: no device traffic at the Worker → FAIL (handshake and polling)', async () => {
  const r = await harness('monitor', '--input', tail('quiet', goodRun().slice(0, 1)));
  expect(r.out).toMatch(/FAIL\s+First handshake through the Worker\s+none/);
  expect(r.out).toMatch(/FAIL\s+Steady polling/);
  expect(r.code).toBe(1);
});

test('monitor: another serial calling /iclock is shown for review, not counted as the device', async () => {
  const t0 = Date.now();
  const r = await harness('monitor', '--input', tail('other', [...goodRun(t0), ev(t0 + 1000, 'getrequest.aspx', { sn: 'SCANNER123' })]));
  expect(r.out).toMatch(/REVIEW\s+\/iclock calls from other serials\s+1/);
  expect(r.out).toMatch(/Steady polling \(>= 100 polls\)\s+120 polls/);
});

test('postcheck: Firestore keeps updating while the Worker is quiet → PASS; the device still on the Worker → FAIL', async () => {
  await diag(new Date(Date.now() + 5 * 60_000));   // stands in for Vercel recording the device again
  const ok = await harness('postcheck', '--input', tail('after', []));
  expect(ok.out).toMatch(/PASS\s+Worker quiet/);
  expect(ok.out).toMatch(/PASS\s+Firestore updated by Vercel after restore/);
  expect(ok.out).toMatch(/PASS\s+Queued commands unchanged vs baseline/);
  expect(ok.out).toContain('RESULT: PASS');
  expect(ok.code).toBe(0);
  const late = Date.now() + 10 * 60_000;
  const bad = await harness('postcheck', '--input', tail('still', [ev(late, 'getrequest.aspx'), ev(late + 3600, 'getrequest.aspx')]));
  expect(bad.out).toMatch(/FAIL\s+Worker quiet \(no device \/iclock after 30 s\)\s+2 late/);
  expect(bad.code).toBe(1);
});

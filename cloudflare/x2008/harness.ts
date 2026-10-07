// X2008 test harness: READ-ONLY preparation and monitoring for the physical-device test.
//
// Architecture it checks for (production since 5 Oct 2026): www.crunnchhfitness.com is a Worker
// Custom Domain of `crunch-site` on the active Cloudflare zone, so the X2008 — which calls
// https://www.crunnchhfitness.com/iclock/… — reaches this Worker through DNS, and the Worker relays
// it to the old ADMS server. During testing the Worker runs with ADMS_DELIVER_CRM_COMMANDS=0: no
// CRM-generated command (Open door, add user, enrolment, user-list requests) reaches the device.
// (crunch-site.gsalunke169.workers.dev still serves the same Worker; the device doesn't use it.)
// See cloudflare/X2008_FINAL_TEST_RUNBOOK.md.
//
//   npm run x2008 -- preflight    the live version at 100%, the safety switch, the one secret, exactly
//                                 one custom domain (www), zone active, no zone routes; the device's
//                                 CRM record, queue = 0, no unanswered commands, recent polling and
//                                 answers; saves the baseline (commands, diagnostics, old-server verbs)
//   npm run x2008 -- monitor      live Worker log for the device's /iclock traffic + a Firestore read
//                                 every 60 s; Enter = mark a test step, r = mark the end (finishes
//                                 60 s later), q = finish now
//   npm run x2008 -- postcheck    only after the device has been moved OFF this Worker (a rollback to
//                                 Vercel): the Worker goes quiet, Firestore keeps being updated
//                                 elsewhere, command counts unchanged
//
// It never writes and never talks to the device. Two independent guards make that hold:
//   1. network: every fetch is checked — Firestore GET and read queries only, Google's token
//      endpoint, Cloudflare API GETs only; anything else (any /iclock URL, any Firestore commit,
//      transaction or write) throws before a byte is sent;
//   2. the Firestore client's write methods are replaced with ones that throw.
// wrangler is only run as: deployments status, versions view, secret list, tail.
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, createWriteStream, createReadStream, type WriteStream } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { initializeApp } from '../src/admin-app';
import { Firestore, WriteBatch, getFirestore } from '../src/firestore-rest';

// ── Settings ─────────────────────────────────────────────────────────────────────────────────────
const SN = 'JJA1254700696';
const WORKER = 'crunch-site';
const ACCOUNT = 'da6f102c1f0f6055bf42c52cfe5744aa';
const ZONE = 'crunnchhfitness.com';
const GYM = 'crunch-wakad';
const PROD_HOST = 'www.crunnchhfitness.com';   // the Worker Custom Domain the X2008 calls
const EXPECT_VERSION = process.env.X2008_EXPECT_VERSION ?? 'f4cfcfc0-07a9-49f5-83be-bbee4870f4f6';
const HERE = dirname(fileURLToPath(import.meta.url));
const CF_DIR = join(HERE, '..');
const RUNS = process.env.X2008_RUNS_DIR ?? join(homedir(), '.crunch-x2008');
const SECRET_LIKE = /private_key|BEGIN [A-Z ]*PRIVATE KEY|\bya29\.[\w-]{20,}|\beyJhbGci[\w-]{20,}|bearer\s+[\w.-]{20,}/i;

const argv = process.argv.slice(2);
const mode = argv[0];
const flag = (name: string) => argv.includes(`--${name}`);
const opt = (name: string) => { const i = argv.indexOf(`--${name}`); return i > 0 ? argv[i + 1] : undefined; };
const EMULATOR = flag('emulator');   // tests only: Firestore emulator, no Cloudflare checks
const EMU_VARS = ['FIRESTORE_EMULATOR_HOST', 'FIRESTORE_EMULATOR_URL', 'FIREBASE_AUTH_EMULATOR_HOST'];

// ── Guard 1: the network ─────────────────────────────────────────────────────────────────────────
const realFetch = globalThis.fetch;
const emuOrigin = process.env.FIRESTORE_EMULATOR_URL ?? (process.env.FIRESTORE_EMULATOR_HOST ? `http://${process.env.FIRESTORE_EMULATOR_HOST}` : null);
function allowed(urlText: string, method: string): string | null {
  const url = new URL(urlText);
  const m = method.toUpperCase();
  if (/\/iclock(\/|$)/i.test(url.pathname)) return 'the harness never calls /iclock';
  const firestore = url.hostname === 'firestore.googleapis.com' || (EMULATOR && emuOrigin && url.origin === new URL(emuOrigin).origin);
  if (firestore) {
    if (m === 'GET') return null;
    if (m === 'POST' && /:(runQuery|batchGet|runAggregationQuery)$/.test(url.pathname)) return null;
    return `Firestore ${m} ${url.pathname.split(':').at(-1)} is a write`;
  }
  if (url.hostname === 'oauth2.googleapis.com' && url.pathname === '/token' && m === 'POST') return null;   // service-account sign-in
  if (url.hostname === 'api.cloudflare.com' && m === 'GET') return null;
  return `${m} ${url.host} is not on the read-only list`;
}
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
  const why = allowed(href, method);
  if (why) throw new Error(`READ-ONLY guard: blocked (${why})`);
  return realFetch(input, init);
}) as typeof fetch;

// ── Guard 2: the Firestore client ────────────────────────────────────────────────────────────────
const refuse = (what: string) => () => { throw new Error(`READ-ONLY guard: ${what} is blocked`); };
for (const m of ['commit', 'batch', 'runTransaction']) (Firestore.prototype as unknown as Record<string, unknown>)[m] = refuse(`Firestore.${m}`);
for (const m of ['set', 'update', 'delete', 'create', 'commit']) (WriteBatch.prototype as unknown as Record<string, unknown>)[m] = refuse(`batch.${m}`);

/** Prove both guards are on: every attempt below must be refused locally, before anything is sent. */
async function guardChecks(): Promise<Check[]> {
  const blocked = async (what: string, attempt: () => unknown) => {
    try { await attempt(); return { name: `Guard blocks ${what}`, verdict: 'FAIL' as Verdict, detail: 'NOT blocked' }; }
    catch (e) { const m = (e as Error).message; return { name: `Guard blocks ${what}`, verdict: (m.startsWith('READ-ONLY guard') ? 'PASS' : 'FAIL') as Verdict, detail: m.startsWith('READ-ONLY guard') ? 'refused locally' : m }; }
  };
  const fsBase = EMULATOR && emuOrigin ? emuOrigin : 'https://firestore.googleapis.com';
  return [
    await blocked('/iclock on workers.dev', () => fetch(`https://${WORKER}.gsalunke169.workers.dev/iclock/getrequest.aspx?SN=${SN}`)),
    await blocked('/iclock on the production domain', () => fetch(`https://www.${ZONE}/iclock/cdata.aspx?SN=${SN}`)),
    await blocked('Firestore commit (HTTP)', () => fetch(`${fsBase}/v1/projects/x/databases/(default)/documents:commit`, { method: 'POST', body: '{}' })),
    await blocked('Firestore transaction (HTTP)', () => fetch(`${fsBase}/v1/projects/x/databases/(default)/documents:beginTransaction`, { method: 'POST', body: '{}' })),
    await blocked('Firestore PATCH (HTTP)', () => fetch(`${fsBase}/v1/projects/x/databases/(default)/documents/a/b`, { method: 'PATCH', body: '{}' })),
    await blocked('Firestore client batch()', () => (Firestore.prototype as unknown as { batch: () => unknown }).batch()),
    await blocked('Firestore client commit()', () => (Firestore.prototype as unknown as { commit: () => unknown }).commit()),
    await blocked('Batch set/update/delete', () => (WriteBatch.prototype as unknown as { update: () => unknown }).update()),
    await blocked('Firestore client runTransaction()', () => (Firestore.prototype as unknown as { runTransaction: () => unknown }).runTransaction()),
    await blocked('Cloudflare API writes', () => fetch('https://api.cloudflare.com/client/v4/zones', { method: 'POST', body: '{}' })),
  ];
}

// ── Output ───────────────────────────────────────────────────────────────────────────────────────
type Verdict = 'PASS' | 'FAIL' | 'REVIEW' | 'SKIP';
interface Check { name: string; verdict: Verdict; detail: string }
const color = (v: Verdict) => (process.stdout.isTTY ? { PASS: '\x1b[32m', FAIL: '\x1b[31m', REVIEW: '\x1b[33m', SKIP: '\x1b[90m' }[v] : '');
const reset = process.stdout.isTTY ? '\x1b[0m' : '';
const hhmmss = (ms = Date.now()) => new Date(ms).toTimeString().slice(0, 8);
function report(title: string, checks: Check[]) {
  const overall: Verdict = checks.some((c) => c.verdict === 'FAIL') ? 'FAIL' : checks.some((c) => c.verdict === 'REVIEW') ? 'REVIEW' : 'PASS';
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 70 - title.length))}`);
  for (const c of checks) console.log(`  ${color(c.verdict)}${c.verdict.padEnd(6)}${reset} ${c.name.padEnd(50)} ${c.detail}`);
  console.log(`\n  RESULT: ${color(overall)}${overall}${reset}${overall === 'REVIEW' ? ' (no failure; read the REVIEW lines before going on)' : ''}\n`);
  return overall;
}
const banner = (text: string) => console.log(`\n${process.stdout.isTTY ? '\x1b[41m\x1b[97m' : ''} >>> ${text} <<< ${reset}\n`);

// ── Firestore (read-only) ────────────────────────────────────────────────────────────────────────
interface Cmd { id: string; type: string; ageS: number | null }
interface State {
  at: number;
  device: { id: string; enabled: unknown; protocol: unknown; lastSeenAt: number | null; lastError: unknown } | null;
  devices: number;
  diag: { lastSeenAt: number | null; lastKind: unknown; lastStatus: unknown; lastUpstreamStatus: unknown; pushVersion: unknown; userAgent: unknown; counts: Record<string, number> } | null;
  oldServerCommands: string[];
  recent: { kinds: Record<string, number>; statuses: Record<string, number> };
  queued: Cmd[];
  sent: Cmd[];
}
const ms = (v: unknown) => (v as { toMillis?: () => number } | undefined)?.toMillis?.() ?? null;
function db() {
  if (EMULATOR) {
    if (!emuOrigin) throw new Error('--emulator needs FIRESTORE_EMULATOR_HOST');
    return getFirestore(initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'demo-crunch' }));
  }
  const set = EMU_VARS.filter((k) => process.env[k]);
  if (set.length) throw new Error(`Refusing: ${set.join(', ')} set — this would read a test database, not production`);
  const file = process.env.SA_FILE ?? join(homedir(), '.secrets/crunch-adms-worker.json');
  return getFirestore(initializeApp({ credential: JSON.parse(readFileSync(file, 'utf8')) }));
}
async function readState(): Promise<State> {
  const fs = db();
  const devs = await fs.collection('gyms').doc(GYM).collection('devices').where('serialNumber', '==', SN).limit(2).get();
  const dev = devs.size === 1 ? devs.docs[0] : null;
  const d = await fs.collection('admsDiagnostics').doc(SN).get();
  const last = d.get('last') as Record<string, unknown> | undefined;
  const recent = (d.get('recent') as Record<string, unknown>[] | undefined) ?? [];
  const tally = (f: (e: Record<string, unknown>) => string) => recent.reduce<Record<string, number>>((t, e) => { t[f(e)] = (t[f(e)] ?? 0) + 1; return t; }, {});
  const cmds = async (status: string): Promise<Cmd[]> => {
    if (!dev) return [];
    const s = await dev.ref.collection('commands').where('status', '==', status).limit(100).get();
    return s.docs.map((c) => { const t = ms(c.get('createdAt')); return { id: c.id, type: String(c.get('type')), ageS: t ? Math.round((Date.now() - t) / 1000) : null }; }).sort((a, b) => a.id.localeCompare(b.id));
  };
  return {
    at: Date.now(),
    devices: devs.size,
    device: dev ? { id: dev.id, enabled: dev.get('enabled'), protocol: dev.get('protocol'), lastSeenAt: ms(dev.get('lastSeenAt')), lastError: dev.get('lastError') ?? null } : null,
    diag: d.exists ? { lastSeenAt: ms(d.get('lastSeenAt')), lastKind: last?.kind, lastStatus: last?.status, lastUpstreamStatus: last?.upstreamStatus, pushVersion: d.get('pushVersion'), userAgent: d.get('lastUserAgent'), counts: (d.get('counts') as Record<string, number>) ?? {} } : null,
    oldServerCommands: [...new Set(recent.flatMap((e) => (e.upstreamCommands as string[] | undefined) ?? []).map((v) => v.replace(/ ×\d+$/, '')))],
    recent: { kinds: tally((e) => String(e.kind)), statuses: tally((e) => `${e.status}/${e.upstreamStatus}`) },
    queued: await cmds('queued'),
    sent: await cmds('sent'),
  };
}
const ids = (c: Cmd[]) => c.map((x) => x.id).join(',');
const iso = (t: number | null | undefined) => (t ? new Date(t).toISOString() : 'never');
function stateLine(s: State) {
  return `device lastSeenAt ${iso(s.device?.lastSeenAt)} lastError ${JSON.stringify(s.device?.lastError ?? null)} | diagnostics lastSeenAt ${iso(s.diag?.lastSeenAt)} (${s.diag?.lastKind ?? '-'} ${s.diag?.lastStatus ?? '-'}/${s.diag?.lastUpstreamStatus ?? '-'}) | queued ${s.queued.length} sent ${s.sent.length}`;
}

// ── Cloudflare (read-only) ───────────────────────────────────────────────────────────────────────
const WRANGLER = join(CF_DIR, 'node_modules/.bin/wrangler');
const READ_ONLY_WRANGLER = new Set(['deployments status', 'versions view', 'secret list']);   // tail is spawned on its own
function wrangler(args: string[]): Promise<string> {
  if (!READ_ONLY_WRANGLER.has(args.slice(0, 2).join(' '))) throw new Error(`READ-ONLY guard: wrangler ${args[0]} is not allowed`);
  return new Promise((ok, fail) => execFile(WRANGLER, args, { cwd: CF_DIR, env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, maxBuffer: 8 << 20 }, (e, out, err) => (e ? fail(new Error(`wrangler ${args.slice(0, 2).join(' ')}: ${(err || e.message).split('\n').filter(Boolean).slice(-2).join(' ')}`)) : ok(out))));
}
function cfToken(): string | null {
  if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN;
  const f = join(homedir(), '.config/.wrangler/config/default.toml');
  return existsSync(f) ? readFileSync(f, 'utf8').match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1] ?? null : null;
}
async function cfGet(path: string) {
  const t = cfToken();
  if (!t) throw new Error('no Cloudflare login (run: npx wrangler login)');
  const r = (await (await fetch(`https://api.cloudflare.com/client/v4${path}`, { headers: { Authorization: `Bearer ${t}` } })).json()) as { success: boolean; result: unknown; errors?: { message: string }[] };
  if (!r.success) throw new Error(r.errors?.[0]?.message ?? 'Cloudflare API error');
  return r.result;
}
/** What Cloudflare says about the Worker and the zone — gathered read-only, judged by cloudflareVerdicts(). */
interface CloudflareFacts {
  versions?: { version_id: string; percentage: number }[];
  bindings?: { name: string; type: string; text?: string | null }[];
  secrets?: string[];
  domains?: { hostname: string; service?: string; environment?: string }[];
  zone?: { status: string } | null;
  routes?: { pattern: string }[];
  errors: { worker?: string; zone?: string };
}
async function cloudflareFacts(): Promise<CloudflareFacts> {
  const f: CloudflareFacts = { errors: {} };
  try {
    f.versions = (JSON.parse(await wrangler(['deployments', 'status', '--json'])) as { versions: { version_id: string; percentage: number }[] }).versions;
    if (f.versions[0]) f.bindings = (JSON.parse(await wrangler(['versions', 'view', f.versions[0].version_id, '--json'])) as { resources: { bindings: { name: string; type: string; text?: string }[] } }).resources.bindings;
    f.secrets = (JSON.parse(await wrangler(['secret', 'list', '--format', 'json'])) as { name: string }[]).map((x) => x.name);
  } catch (e) { f.errors.worker = (e as Error).message; }
  try {
    f.domains = (await cfGet(`/accounts/${ACCOUNT}/workers/domains`)) as { hostname: string; service: string; environment: string }[];
    const zones = (await cfGet(`/zones?name=${ZONE}`)) as { id: string; status: string }[];
    f.zone = zones[0] ? { status: zones[0].status } : null;
    if (zones[0]) f.routes = (await cfGet(`/zones/${zones[0].id}/workers/routes`)) as { pattern: string }[];
  } catch (e) { f.errors.zone = (e as Error).message; }
  return f;
}
/**
 * The production architecture this test runs in: www.crunnchhfitness.com is a Worker Custom Domain
 * on the active crunnchhfitness.com zone, so the X2008 (which calls www.crunnchhfitness.com) reaches
 * this Worker through DNS. Anything else — another version or a split rollout, the safety switch
 * missing, an extra or missing domain, an inactive zone, a zone route, unreadable settings — is a FAIL.
 */
function cloudflareVerdicts(f: CloudflareFacts): Check[] {
  const out: Check[] = [];
  const add = (name: string, ok: boolean, detail: string) => out.push({ name, verdict: ok ? 'PASS' : 'FAIL', detail });
  if (f.errors.worker || !f.versions || !f.bindings || !f.secrets) add('Worker configuration readable', false, f.errors.worker ?? 'incomplete');
  else {
    const v = f.versions;
    add(`Worker version ${EXPECT_VERSION.slice(0, 8)}… live at 100%`, v.length === 1 && v[0].version_id === EXPECT_VERSION && v[0].percentage === 100, v.map((x) => `${x.version_id} (${x.percentage}%)`).join(', ') || 'none');
    const b = new Map(f.bindings.map((x) => [x.name, x]));
    add('ADMS_DELIVER_CRM_COMMANDS = "0"', b.get('ADMS_DELIVER_CRM_COMMANDS')?.text === '0', JSON.stringify(b.get('ADMS_DELIVER_CRM_COMMANDS')?.text ?? 'absent'));
    add('ADMS_UPSTREAM = old server', b.get('ADMS_UPSTREAM')?.text === 'http://122.160.158.120:5072', b.get('ADMS_UPSTREAM')?.text ?? 'absent');
    add('FIREBASE_SERVICE_ACCOUNT bound in version', b.get('FIREBASE_SERVICE_ACCOUNT')?.type === 'secret_text', b.get('FIREBASE_SERVICE_ACCOUNT')?.type ?? 'absent');
    const emu = EMU_VARS.filter((k) => b.has(k));
    add('No emulator settings on the Worker', !emu.length, emu.join(', ') || 'none');
    add('Secrets = FIREBASE_SERVICE_ACCOUNT only', f.secrets.length === 1 && f.secrets[0] === 'FIREBASE_SERVICE_ACCOUNT', f.secrets.join(', ') || 'none');
  }
  if (f.errors.zone || !f.domains || f.zone === undefined) add('Domains / zone / routes readable', false, `${f.errors.zone ?? 'incomplete'} — check in the dashboard`);
  else {
    const d = f.domains;
    add(`Exactly one custom domain: ${PROD_HOST} → ${WORKER} (production)`, d.length === 1 && d[0].hostname === PROD_HOST && d[0].service === WORKER && (d[0].environment ?? 'production') === 'production', d.map((x) => `${x.hostname} → ${x.service ?? '?'} (${x.environment ?? '?'})`).join(', ') || 'none');
    add(`Zone ${ZONE} active (Cloudflare nameservers)`, f.zone?.status === 'active', f.zone ? `status ${f.zone.status}` : 'no zone');
    add('No Worker routes on the zone', !!f.routes && f.routes.length === 0, f.routes ? f.routes.map((r) => r.pattern).join(', ') || 'none' : 'unreadable');
  }
  return out;
}
async function cloudflareChecks(): Promise<Check[]> {
  const file = opt('cloudflare-facts');
  // Recorded facts (tests) are accepted ONLY with --emulator: a real preflight always asks Cloudflare
  if (file && !EMULATOR) return [{ name: 'Cloudflare facts from a file', verdict: 'FAIL', detail: '--cloudflare-facts is for --emulator tests only' }];
  return cloudflareVerdicts(file ? (JSON.parse(readFileSync(file, 'utf8')) as CloudflareFacts) : await cloudflareFacts());
}

// ── Runs (baseline and logs; outside the repo: raw logs contain device traffic) ──────────────────
function newRun() { const d = join(RUNS, new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)); mkdirSync(d, { recursive: true }); writeFileSync(join(RUNS, 'LATEST'), d); return d; }
function lastRun(): string {
  const d = opt('run') ?? (existsSync(join(RUNS, 'LATEST')) ? readFileSync(join(RUNS, 'LATEST'), 'utf8').trim() : '');
  if (!d || !existsSync(join(d, 'baseline.json'))) throw new Error('No baseline: run "npm run x2008 -- preflight" first');
  return d;
}
interface Baseline { at: number; verdict: Verdict; state: State }

// ── preflight ────────────────────────────────────────────────────────────────────────────────────
async function preflight() {
  console.log(`X2008 preflight (read-only) — ${new Date().toISOString()}`);
  const checks: Check[] = await guardChecks();
  if (checks.some((c) => c.verdict === 'FAIL')) return report('PREFLIGHT (guards)', checks) && 1;
  checks.push(...(EMULATOR && !opt('cloudflare-facts') ? [{ name: 'Cloudflare checks', verdict: 'SKIP' as Verdict, detail: '--emulator' }] : await cloudflareChecks()));
  let state: State | null = null;
  try { state = await readState(); } catch (e) { checks.push({ name: 'Firestore readable', verdict: 'FAIL', detail: (e as Error).message }); }
  if (state) {
    checks.push({ name: `Exactly one CRM device with serial ${SN}`, verdict: state.devices === 1 ? 'PASS' : 'FAIL', detail: `${state.devices} found${state.device ? ` (${state.device.id}, enabled ${state.device.enabled})` : ''}` });
    checks.push({ name: 'Queued CRM commands = 0', verdict: state.queued.length === 0 ? 'PASS' : 'FAIL', detail: state.queued.length ? state.queued.map((c) => `${c.id}:${c.type}`).join(', ') : '0' });
    checks.push({ name: 'Sent, unanswered CRM commands', verdict: state.sent.length === 0 ? 'PASS' : 'REVIEW', detail: state.sent.length ? state.sent.map((c) => `${c.id}:${c.type}`).join(', ') : '0' });
    const fresh = state.diag?.lastSeenAt && Date.now() - state.diag.lastSeenAt < 15 * 60_000;
    checks.push({ name: 'Device polling today (diagnostics < 15 min)', verdict: fresh ? 'PASS' : 'FAIL', detail: iso(state.diag?.lastSeenAt) });
    checks.push({ name: 'Device lastError empty', verdict: state.device?.lastError ? 'FAIL' : 'PASS', detail: JSON.stringify(state.device?.lastError ?? null) });
    checks.push({ name: 'Baseline: old-server command verbs', verdict: 'PASS', detail: state.oldServerCommands.join(', ') || 'none in the last 25 contacts' });
    checks.push({ name: 'Baseline: recent answers (status/old server)', verdict: Object.keys(state.recent.statuses).every((k) => k === '200/200') ? 'PASS' : 'REVIEW', detail: JSON.stringify(state.recent.statuses) });
  }
  const verdict = report('PREFLIGHT', checks);
  const run = newRun();
  writeFileSync(join(run, 'baseline.json'), JSON.stringify({ at: Date.now(), verdict, state: state as State, checks } satisfies Baseline & { checks: Check[] }, null, 2));   // a FAIL baseline (state may be null) is refused by monitor/postcheck
  console.log(`  baseline saved: ${join(run, 'baseline.json')}`);
  if (verdict === 'FAIL') console.log('  STOP: do not touch the X2008.');
  return verdict === 'FAIL' ? 1 : 0;
}

// ── Worker log stream ────────────────────────────────────────────────────────────────────────────
interface TailEvent { outcome?: string; cpuTime?: number; eventTimestamp?: number; exceptions?: unknown[]; scriptVersion?: { id?: string }; logs?: { level?: string; message?: unknown[] }[]; event?: { request?: { url?: string; method?: string }; response?: { status?: number } } }
/** `wrangler tail --format json` writes pretty-printed objects back to back: split on balanced braces. */
function objectSplitter(onObject: (text: string) => void) {
  let buf = ''; let depth = 0; let inStr = false; let esc = false; let start = -1;
  return (chunk: string) => {
    for (const ch of chunk) {
      buf += ch;
      if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true;
      else if (ch === '{') { if (depth++ === 0) start = buf.length - 1; }
      else if (ch === '}' && depth > 0 && --depth === 0) { onObject(buf.slice(start)); buf = ''; start = -1; }
    }
    if (depth === 0 && !inStr) buf = '';
  };
}
interface Seen {
  t: number; kind: string; http: number | null; outcome: string; cpu: number; exceptions: number; version: string;
  upstreamStatus: number | null; note: string | null; upstreamCommands: string[]; sn: string;
}
function parseEvent(ev: TailEvent): Seen | null {
  const url = ev.event?.request?.url;
  if (!url) return null;
  const u = new URL(url);
  if (!u.pathname.startsWith('/iclock')) return null;
  const relay = (ev.logs ?? []).flatMap((l) => l.message ?? []).filter((m): m is string => typeof m === 'string')
    .map((m) => { try { return JSON.parse(m) as Record<string, unknown>; } catch { return null; } })
    .find((m) => m?.adms && m.kind !== 'firestore usage');
  const path = u.pathname.replace(/^\/iclock\/?/, '').replace(/\.aspx$/, '');
  const method = ev.event?.request?.method ?? 'GET';
  return {
    t: ev.eventTimestamp ?? Date.now(),
    kind: String(relay?.kind ?? (path === 'cdata' && method === 'GET' ? (u.searchParams.has('options') ? 'handshake' : 'cdata GET') : path === 'getrequest' ? 'command poll' : `${method} ${path}`)),
    http: ev.event?.response?.status ?? null,
    outcome: ev.outcome ?? '?', cpu: ev.cpuTime ?? 0, exceptions: ev.exceptions?.length ?? 0, version: ev.scriptVersion?.id ?? '?',
    upstreamStatus: (relay?.upstreamStatus as number | null | undefined) ?? null,
    note: (relay?.note as string | undefined) ?? null,
    upstreamCommands: ((relay?.upstreamCommands as string[] | undefined) ?? []).map((v) => v.replace(/ ×\d+$/, '')),
    sn: (u.searchParams.get('SN') ?? '').toUpperCase(),
  };
}
/** Feed Worker events from `wrangler tail` (or a saved file, for tests) until stopped. */
function workerEvents(rawFile: WriteStream, onEvent: (s: Seen | null, rawText: string) => void): { stop: () => void; done: Promise<void> } {
  const input = opt('input');
  let child: ChildProcess | null = null;
  const split = objectSplitter((text) => {
    rawFile.write(text + '\n');
    try { onEvent(parseEvent(JSON.parse(text) as TailEvent), text); } catch { onEvent(null, text); }
  });
  const done = new Promise<void>((resolve) => {
    if (input) {
      const s = createReadStream(input, 'utf8');
      s.on('data', (c) => split(String(c)));
      s.on('end', () => resolve());
    } else {
      child = spawn(WRANGLER, ['tail', WORKER, '--format', 'json'], { cwd: CF_DIR, env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, stdio: ['ignore', 'pipe', 'pipe'] });
      child.stdout!.setEncoding('utf8').on('data', (c: string) => split(c));
      child.stderr!.setEncoding('utf8').on('data', (c: string) => { if (/error/i.test(c)) console.error(`[tail] ${c.trim()}`); });
      child.on('exit', () => resolve());
    }
  });
  return { stop: () => child?.kill('SIGINT'), done };
}
function interactive(onLine: (l: string) => void) {
  if (!process.stdin.isTTY) return () => {};
  const rl = createInterface({ input: process.stdin });
  rl.on('line', (l) => onLine(l.trim().toLowerCase()));
  return () => rl.close();
}

// ── monitor ──────────────────────────────────────────────────────────────────────────────────────
async function monitor() {
  const run = lastRun();
  const base = JSON.parse(readFileSync(join(run, 'baseline.json'), 'utf8')) as Baseline;
  if (base.verdict === 'FAIL' || !base.state) { banner('The preflight FAILED — run it again and fix it before the test'); return 1; }
  if (Date.now() - base.at > 2 * 3600_000) { banner('The baseline is over 2 hours old — run the preflight again'); return 1; }
  const minPolls = Number(opt('min-polls') ?? 100);
  const firstContactS = Number(opt('first-contact-s') ?? 180);
  const raw = createWriteStream(join(run, `monitor-tail-${Date.now()}.jsonl`));
  const started = Date.now();
  let changedAt: number | null = null; let restoredAt: number | null = null;
  const seen: Seen[] = []; const other: Seen[] = []; const problems: string[] = []; let secretHits = 0;
  const stateChanges: string[] = []; let lastState: State | null = null; let checksRun = 0;
  const versions = new Set<string>();

  console.log(`X2008 monitor (read-only) — run ${run}`);
  console.log(`  Worker log: ${opt('input') ? `file ${opt('input')}` : `wrangler tail ${WORKER}`}; Firestore read every 60 s.`);
  console.log('  Enter = mark a test step (e.g. the X2008 saved or restarted); r + Enter = mark the end (finishes 60 s later); q + Enter = finish now.\n');

  const onEvent = (s: Seen | null, text: string) => {
    if (SECRET_LIKE.test(text)) { secretHits++; banner('Secret-like text in the Worker log — finish and report'); }
    if (!s) return;
    versions.add(s.version);
    if (s.sn !== SN) { other.push(s); console.log(`${hhmmss(s.t)}  (not the device: SN ${s.sn || 'none'}) ${s.kind} ${s.http}`); return; }
    seen.push(s);
    const bad = (s.http ?? 0) >= 400 || s.outcome !== 'ok' || s.exceptions > 0 || (s.upstreamStatus !== null && s.upstreamStatus !== 200) || !!s.note;
    console.log(`${hhmmss(s.t)}  ${s.kind.padEnd(16)} http ${s.http ?? '-'}  old server ${s.upstreamStatus ?? '-'}  cpu ${s.cpu}ms${s.note ? `  NOTE: ${s.note}` : ''}${s.upstreamCommands.length ? `  old-server cmds: ${s.upstreamCommands.join(', ')}` : ''}${bad ? '  <<< PROBLEM' : ''}`);
    if (bad) { problems.push(`${hhmmss(s.t)} ${s.kind}: http ${s.http}, outcome ${s.outcome}, exceptions ${s.exceptions}, old server ${s.upstreamStatus}${s.note ? `, ${s.note}` : ''}`); banner(`PROBLEM: ${problems.at(-1)} — STOP and follow the runbook`); }
    if (s.kind === 'handshake') console.log('            ^ first handshake through the Worker');
  };
  const tail = workerEvents(raw, onEvent);
  const firestoreTick = async () => {
    try {
      const s = await readState(); checksRun++;
      if (ids(s.queued) !== ids(base.state.queued) || ids(s.sent) !== ids(base.state.sent)) {
        const msg = `${hhmmss()} command queue changed: queued [${ids(s.queued)}] sent [${ids(s.sent)}] (baseline queued [${ids(base.state.queued)}] sent [${ids(base.state.sent)}])`;
        if (!stateChanges.includes(msg)) { stateChanges.push(msg); banner(msg); }
      }
      lastState = s;
      const recentPolls = seen.filter((x) => x.kind === 'command poll' && x.t > Date.now() - 60_000).length;
      console.log(`${hhmmss()}  [firestore] ${stateLine(s)} | device requests ${seen.length} (polls last 60 s: ${recentPolls})`);
    } catch (e) { console.log(`${hhmmss()}  [firestore] read failed: ${(e as Error).message}`); }
  };
  await firestoreTick();
  const tick = setInterval(firestoreTick, 60_000);
  const watchdog = setInterval(() => {
    const from = changedAt ?? started;
    if (!restoredAt && !seen.length && Date.now() - from > firstContactS * 1000) banner(`No device request at the Worker ${Math.round((Date.now() - from) / 1000)} s after ${changedAt ? 'the marked step' : 'start'} — the device is not reaching the Worker (DNS/TLS/address): STOP and follow the runbook`);
    const lastT = seen.at(-1)?.t;
    if (!restoredAt && lastT && Date.now() - lastT > 60_000) banner(`The device stopped calling the Worker ${Math.round((Date.now() - lastT) / 1000)} s ago`);
  }, 30_000);
  const minutes = Number(opt('minutes') ?? 0);
  let stopAt: NodeJS.Timeout | null = null;
  const finish = () => { tail.stop(); };
  const closeInput = interactive((l) => {
    if (l === '' && !changedAt) { changedAt = Date.now(); console.log(`${hhmmss()}  marked: test step`); }
    else if (l === 'r') { restoredAt = Date.now(); console.log(`${hhmmss()}  marked: end — finishing in 60 s`); setTimeout(finish, 60_000); }
    else if (l === 'q') finish();
  });
  process.once('SIGINT', finish);
  if (minutes > 0) stopAt = setTimeout(finish, minutes * 60_000);
  await tail.done;
  clearInterval(tick); clearInterval(watchdog); if (stopAt) clearTimeout(stopAt); closeInput();
  await firestoreTick();
  raw.end();

  // ── Verdict
  const polls = seen.filter((s) => s.kind === 'command poll');
  const gaps = polls.slice(1).map((p, i) => (p.t - polls[i].t) / 1000).sort((a, b) => a - b);
  const median = gaps.length ? gaps[Math.floor(gaps.length / 2)] : null;
  const span = seen.length ? (seen.at(-1)!.t - seen[0].t) / 1000 : 0;
  const newVerbs = [...new Set(seen.flatMap((s) => s.upstreamCommands))].filter((v) => !base.state.oldServerCommands.includes(v));
  const uploads = seen.filter((s) => /upload|cdata POST/i.test(s.kind));
  const end = lastState as State | null;
  const checks: Check[] = [
    { name: 'Worker version in every log event', verdict: [...versions].every((v) => opt('input') || v === EXPECT_VERSION) ? 'PASS' : 'FAIL', detail: [...versions].join(', ') || 'no events' },
    { name: 'First handshake through the Worker', verdict: seen.some((s) => s.kind === 'handshake') ? 'PASS' : 'FAIL', detail: seen.find((s) => s.kind === 'handshake') ? hhmmss(seen.find((s) => s.kind === 'handshake')!.t) : 'none' },
    { name: `Steady polling (>= ${minPolls} polls)`, verdict: polls.length >= minPolls ? 'PASS' : polls.length ? 'REVIEW' : 'FAIL', detail: `${polls.length} polls over ${Math.round(span)} s` },
    { name: 'Poll interval (median <= 10 s)', verdict: median === null ? 'REVIEW' : median <= 10 ? 'PASS' : 'REVIEW', detail: median === null ? 'n/a' : `${median.toFixed(1)} s` },
    { name: 'No 4xx/5xx, exceptions or failed outcomes', verdict: problems.length ? 'FAIL' : 'PASS', detail: problems.length ? `${problems.length}: ${problems.slice(0, 3).join(' | ')}` : '0' },
    { name: 'Old server answered 200 to every request', verdict: seen.every((s) => s.upstreamStatus === 200 || s.upstreamStatus === null) && seen.some((s) => s.upstreamStatus === 200) ? 'PASS' : 'FAIL', detail: `${seen.filter((s) => s.upstreamStatus === 200).length}/${seen.length}` },
    { name: 'Worker CPU (max < 10 ms)', verdict: Math.max(0, ...seen.map((s) => s.cpu)) < 10 ? 'PASS' : 'REVIEW', detail: `max ${Math.max(0, ...seen.map((s) => s.cpu))} ms` },
    { name: 'CRM command queue unchanged (queued/sent)', verdict: stateChanges.length ? 'FAIL' : checksRun ? 'PASS' : 'FAIL', detail: stateChanges.length ? stateChanges.join(' | ') : `${checksRun} reads, queued [${ids(base.state.queued)}] sent [${ids(base.state.sent)}]` },
    { name: 'Old-server commands as in the baseline', verdict: newVerbs.length ? 'REVIEW' : 'PASS', detail: newVerbs.length ? `new: ${newVerbs.join(', ')}` : 'nothing new' },
    { name: 'No punch/user uploads in stage 1', verdict: uploads.length ? 'REVIEW' : 'PASS', detail: uploads.length ? `${uploads.length}: ${[...new Set(uploads.map((u) => u.kind))].join(', ')} (recorded as production does)` : '0' },
    { name: 'Diagnostics updated during the test', verdict: end?.diag?.lastSeenAt && end.diag.lastSeenAt > (base.state.diag?.lastSeenAt ?? 0) ? 'PASS' : 'REVIEW', detail: `${iso(base.state.diag?.lastSeenAt)} → ${iso(end?.diag?.lastSeenAt)}` },
    { name: 'Device lastError empty at the end', verdict: end?.device?.lastError ? 'FAIL' : 'PASS', detail: JSON.stringify(end?.device?.lastError ?? null) },
    { name: 'No secret-like text in the Worker log', verdict: secretHits ? 'FAIL' : 'PASS', detail: String(secretHits) },
    { name: '/iclock calls from other serials', verdict: other.length ? 'REVIEW' : 'PASS', detail: String(other.length) },
  ];
  const verdict = report('MONITOR (stage 1: connectivity and polling)', checks);
  writeFileSync(join(run, 'monitor-summary.json'), JSON.stringify({ verdict, checks, changedAt, restoredAt, requests: seen.length, polls: polls.length }, null, 2));
  console.log(`  summary saved: ${join(run, 'monitor-summary.json')}`);
  return verdict === 'FAIL' ? 1 : 0;
}

// ── postcheck ────────────────────────────────────────────────────────────────────────────────────
async function postcheck() {
  const run = lastRun();
  const base = JSON.parse(readFileSync(join(run, 'baseline.json'), 'utf8')) as Baseline;
  if (base.verdict === 'FAIL' || !base.state) { banner('The preflight baseline FAILED — nothing to compare against'); return 1; }
  const windowS = Number(opt('window-s') ?? 420);
  const graceS = 30;
  const raw = createWriteStream(join(run, `postcheck-tail-${Date.now()}.jsonl`));
  const started = Date.now();
  let lastWorkerHit = 0; let lateHits = 0; let sN: State | null = null; let advancedAt: number | null = null;
  console.log(`X2008 postcheck (read-only) — for after a rollback: the device should now be OFF this Worker (back on Vercel). Watching up to ${windowS} s.`);
  const tail = workerEvents(raw, (s) => {
    if (!s || s.sn !== SN) return;
    lastWorkerHit = s.t;
    if (s.t - started > graceS * 1000) { lateHits++; console.log(`${hhmmss(s.t)}  device still calling the Worker: ${s.kind}  <<< not moved off the Worker?`); }
  });
  const tick = async () => {
    sN = await readState().catch(() => sN);
    const t = Math.max(sN?.diag?.lastSeenAt ?? 0, sN?.device?.lastSeenAt ?? 0);
    if (!advancedAt && t > Math.max(started, lastWorkerHit + 5000)) advancedAt = t;
    console.log(`${hhmmss()}  [firestore] ${sN ? stateLine(sN) : 'read failed'}${advancedAt ? '  ← updated without the Worker (Vercel)' : ''}`);
    if (advancedAt && Date.now() - started > 120_000 && !lateHits) tail.stop();
  };
  await tick();
  const iv = setInterval(tick, 30_000);
  const stopAt = setTimeout(() => tail.stop(), windowS * 1000);
  process.once('SIGINT', () => tail.stop());
  await tail.done;
  clearInterval(iv); clearTimeout(stopAt);
  await tick();
  raw.end();
  const end = sN as State | null;
  const checks: Check[] = [
    { name: 'Worker quiet (no device /iclock after 30 s)', verdict: lateHits ? 'FAIL' : 'PASS', detail: `${lateHits} late requests` },
    { name: 'Firestore updated by Vercel after restore', verdict: advancedAt ? 'PASS' : 'FAIL', detail: advancedAt ? `at ${iso(advancedAt)}` : `not within ${windowS} s (check Vercel → Logs → /api/iclock)` },
    { name: 'Queued commands unchanged vs baseline', verdict: end && ids(end.queued) === ids(base.state.queued) ? 'PASS' : 'FAIL', detail: `now [${ids(end?.queued ?? [])}] baseline [${ids(base.state.queued)}]` },
    { name: 'Sent commands unchanged vs baseline', verdict: end && ids(end.sent) === ids(base.state.sent) ? 'PASS' : 'FAIL', detail: `now [${ids(end?.sent ?? [])}] baseline [${ids(base.state.sent)}]` },
    { name: 'Device lastError empty', verdict: end?.device?.lastError ? 'FAIL' : 'PASS', detail: JSON.stringify(end?.device?.lastError ?? null) },
    { name: 'Diagnostics answer 200/200', verdict: end?.diag?.lastStatus === 200 && end.diag.lastUpstreamStatus === 200 ? 'PASS' : 'REVIEW', detail: `${end?.diag?.lastKind ?? '-'} ${end?.diag?.lastStatus ?? '-'}/${end?.diag?.lastUpstreamStatus ?? '-'}` },
  ];
  const verdict = report('POSTCHECK (back on Vercel)', checks);
  writeFileSync(join(run, 'postcheck-summary.json'), JSON.stringify({ verdict, checks }, null, 2));
  return verdict === 'FAIL' ? 1 : 0;
}

// ── main ─────────────────────────────────────────────────────────────────────────────────────────
const modes: Record<string, () => Promise<number>> = { preflight, monitor, postcheck };
if (!modes[mode]) {
  console.log('usage: npm run x2008 -- preflight | monitor | postcheck   (read-only; see cloudflare/X2008_FINAL_TEST_RUNBOOK.md)');
  process.exit(2);
}
modes[mode]().then((code) => process.exit(code), (e) => { console.error(`ERROR: ${(e as Error).message}`); process.exit(1); });

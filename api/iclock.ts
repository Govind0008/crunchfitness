import type { IncomingMessage } from 'node:http';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { firestoreOrNull } from './_lib/firebase.js';
import { ingestScans } from './_lib/ingest.js';
import { meterFor, returnUsage, takeUsage, type Meter } from './_lib/usage.js';
import { PROBE_SN, commandVerbs, logLine, recordContact, requestKind, summarize, type Outcome, type RequestSummary } from './_lib/diagnostics.js';
import {
  OUR_ID, commandText, ownHandshake, parseAttlog, parseCommandResults, parseFingerprintPins, parseUsers, type CommandType,
} from './_lib/adms.js';

// ADMS relay for the gym's fingerprint device (eSSL X2008). The device's "Cloud Server" points
// here; every request is passed on UNCHANGED to the old attendance software's server, and its
// reply goes back to the device — so the old system keeps working exactly as before. On the way
// through, the CRM records scans of linked members, keeps the device's user list for matching,
// and adds its own commands (create a user, start fingerprint enrolment).
//
// Safety: a scan upload is only acknowledged to the device if the old server acknowledged it, so
// the old system can never miss data because of the relay. If the old server is unreachable, the
// device is told to try again later (as it would be without the relay).
//
// Env: FIREBASE_SERVICE_ACCOUNT (JSON of a service account key) — without it the relay still
// passes everything through, it just records nothing. ADMS_UPSTREAM (default the old server);
// set it to "none" once the old software is retired.

const GYM = 'crunch-wakad';
const UPSTREAM = (process.env.ADMS_UPSTREAM ?? 'http://122.160.158.120:5072').replace(/\/$/, '');
const HAS_UPSTREAM = UPSTREAM !== 'none' && UPSTREAM !== '';

export const config = { api: { bodyParser: false } };

const firestore = firestoreOrNull;

/**
 * The request body, byte for byte. Uses 'data'/'end' listeners on purpose: Vercel's Node runtime
 * reads the body before our handler runs and re-attaches it only to those listeners
 * (@vercel/node restoreBody). Iterating the stream (`for await`) would see an already-finished
 * stream there and return an empty body — and an empty scan upload must never be forwarded.
 */
function rawBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer | string) => chunks.push(typeof c === 'string' ? Buffer.from(c) : c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** The device's own query string, without the routing parameter the rewrite adds. */
function deviceQuery(req: VercelRequest) {
  const url = new URL(req.url ?? '/', 'http://relay');
  url.searchParams.delete('path');
  return url.search;
}

async function forward(req: VercelRequest, path: string, body: Buffer | null) {
  const headers: Record<string, string> = {};
  for (const h of ['content-type', 'user-agent', 'accept', 'cookie', 'pragma']) {
    const v = req.headers[h];
    if (typeof v === 'string') headers[h] = v;
  }
  const res = await fetch(`${UPSTREAM}/iclock/${path}${deviceQuery(req)}`, {
    method: req.method, headers, body: body && body.length ? new Uint8Array(body) : undefined, signal: AbortSignal.timeout(20_000),
  });
  return { status: res.status, type: res.headers.get('content-type') ?? 'text/plain', date: res.headers.get('date'), body: Buffer.from(await res.arrayBuffer()) };
}

// ── CRM side ─────────────────────────────────────────────────────────────────
// Serial → CRM device id. A device's id never changes, so a match is kept 30 minutes; "no device
// with this serial" only 5, so a device added in the CRM is picked up quickly.
const deviceCache = new Map<string, { id: string; at: number }>();
async function deviceIdFor(fs: Firestore, sn: string, meter: Meter) {
  const hit = deviceCache.get(sn);
  if (hit && Date.now() - hit.at < (hit.id ? 30 : 5) * 60_000) return hit.id;
  const snap = await fs.collection('gyms').doc(GYM).collection('devices').where('serialNumber', '==', sn.toUpperCase()).limit(1).get();
  meter.read('deviceLookup', Math.max(1, snap.size));
  const id = snap.docs[0]?.id ?? '';
  deviceCache.set(sn, { id, at: Date.now() });
  return id;
}
const devRef = (fs: Firestore, deviceId: string) => fs.collection('gyms').doc(GYM).collection('devices').doc(deviceId);

/**
 * The device's "last communication" (devices/{id}.lastSeenAt), which the CRM's Online/Offline
 * status reads (online = heard from within 10 minutes). Written at most every HEARTBEAT_MS per
 * device per server instance — well inside that window — and at once when it matters: the first
 * request this instance sees, a device back after a quiet spell (it's been longer than
 * HEARTBEAT_MS), or recovery after an error was recorded on the device.
 */
const HEARTBEAT_MS = () => Number(process.env.ADMS_HEARTBEAT_MS ?? 300_000);
const lastBeat = new Map<string, number>();
const errorShown = new Set<string>();
async function heartbeat(fs: Firestore, deviceId: string, meter: Meter) {
  if (!errorShown.has(deviceId) && Date.now() - (lastBeat.get(deviceId) ?? 0) < HEARTBEAT_MS()) return;
  lastBeat.set(deviceId, Date.now());
  errorShown.delete(deviceId);
  await devRef(fs, deviceId).update({ lastSeenAt: FieldValue.serverTimestamp(), lastError: null, connection: 'relay' });
  meter.write('heartbeat');
}

/** The device's users (IDs and names only) for the CRM's Match users screen. */
async function recordUsers(fs: Firestore, deviceId: string, users: ReturnType<typeof parseUsers>, meter: Meter) {
  if (!users.length) return;
  meter.write('deviceUsers', users.length + 1);   // one per user line + the device's usersSeenAt
  meter.read('deviceUsers', users.length);        // their identity records
  const col = devRef(fs, deviceId).collection('deviceUsers');
  for (let i = 0; i < users.length; i += 400) {
    const batch = fs.batch();
    users.slice(i, i + 400).forEach((u) => batch.set(col.doc(u.pin), { deviceUserId: u.pin, name: u.name, admin: u.admin, hasCard: u.hasCard, updatedAt: FieldValue.serverTimestamp() }, { merge: true }));
    await batch.commit();
  }
  // A user now on the device confirms any link waiting for it
  const snaps = await fs.getAll(...users.map((u) => fs.collection('biometricIdentities').doc(`${deviceId}_${u.pin}`)));
  const batch = fs.batch();
  let n = 0;
  snaps.forEach((s) => { if (s.exists && ['PENDING', 'ENROLLED', 'SYNC_FAILED'].includes(s.get('status'))) { batch.update(s.ref, { status: 'SYNCED', lastSyncedAt: FieldValue.serverTimestamp(), lastSyncError: null, updatedAt: FieldValue.serverTimestamp() }); n++; } });
  if (n) { await batch.commit(); meter.write('deviceUsers', n); }
  await devRef(fs, deviceId).update({ usersSeenAt: FieldValue.serverTimestamp() });
}

/** Device-side events in the CRM's activity log (who = the device, never a person). */
function audit(batch: FirebaseFirestore.WriteBatch, fs: Firestore, action: string, event: string, ident: FirebaseFirestore.DocumentSnapshot | null, meta: Record<string, string | number | null> = {}) {
  const trainer = ident?.get('personType') === 'trainer';
  batch.set(fs.collection('activity').doc(), {
    action, actorUid: 'device', actorEmail: 'Fingerprint device', refType: ident ? (trainer ? 'trainer' : 'member') : 'device',
    refId: ident ? (trainer ? ident.get('trainerId') : ident.get('memberId')) ?? null : null, meta: { event, ...meta }, at: FieldValue.serverTimestamp(),
  });
}

/**
 * The device reported a fingerprint template for a user ("FP PIN=…" in an upload): the device
 * itself confirms the fingerprint is enrolled. The template is never read or stored.
 */
async function recordFingerprints(fs: Firestore, deviceId: string, pins: string[], meter: Meter) {
  if (!pins.length) return;
  const snaps = await fs.getAll(...pins.map((p) => fs.collection('biometricIdentities').doc(`${deviceId}_${p}`)));
  meter.read('deviceUsers', pins.length);
  const batch = fs.batch();
  let n = 0;
  snaps.forEach((s) => {
    if (!s.exists || s.get('status') === 'REMOVED') return;
    batch.update(s.ref, {
      status: s.get('status') === 'DISABLED' ? 'DISABLED' : 'SYNCED', enrolledAt: FieldValue.serverTimestamp(), lastSyncedAt: FieldValue.serverTimestamp(), lastSyncError: null, updatedAt: FieldValue.serverTimestamp(),
      enrollment: 'confirmed', enrollmentConfirmedAt: FieldValue.serverTimestamp(), enrollmentEvidence: 'fingerprint_template_reported', enrollmentError: null,
    });
    if (s.get('enrollment') !== 'confirmed') { audit(batch, fs, 'Fingerprint enrolment confirmed by the device', 'ENROLLMENT_CONFIRMED', s, { deviceUserId: s.get('deviceUserId') }); n++; }
    n++;
  });
  if (n) { await batch.commit(); meter.write('deviceUsers', n); }
}

/**
 * Queued CRM commands → "C:<id>:<command>" lines (at most a few per poll). The device polls every
 * few seconds; looking for queued commands on every poll costs a database read each time, so each
 * server instance looks at most every COMMAND_CHECK_MS (a request reaches the device within ~10s).
 */
// Read on each use (not once at load) so tests can switch between immediate and production timing
const COMMAND_CHECK_MS = () => Number(process.env.ADMS_COMMAND_CHECK_MS ?? 10_000);
const lastCommandCheck = new Map<string, number>();
/**
 * Fast lane: a Firestore listener on this device's queued commands tells this server instance the
 * moment staff queue something (e.g. "Open door"), so it goes out on the very next poll (~3–4 s)
 * instead of waiting for the periodic check. A listener only costs reads when a command is added
 * or changes. While it's healthy the periodic check becomes a 20-second safety net — shorter than
 * an unlock's 30-second expiry, so a silently stalled listener can't make "Open door" expire
 * unsent; if it fails, the 10-second check takes over again. ADMS_COMMAND_LISTEN=0 turns it off.
 */
const COMMAND_SAFETY_MS = 20_000;
const queueWatch = new Map<string, { pending: boolean; healthy: boolean }>();
function watchQueue(fs: Firestore, deviceId: string, meter: Meter) {
  if (process.env.ADMS_COMMAND_LISTEN === '0') return null;
  const existing = queueWatch.get(deviceId);
  if (existing) return existing;
  const w = { pending: true, healthy: false };   // look once straight away
  queueWatch.set(deviceId, w);
  try {
    devRef(fs, deviceId).collection('commands').where('status', '==', 'queued').limit(1).onSnapshot((snap) => {
      meter.read('commands', Math.max(1, snap.docChanges().length));
      w.healthy = true;
      if (!snap.empty) w.pending = true;
    }, (e) => { console.error('[iclock] command listener', e.message); queueWatch.delete(deviceId); });
  } catch (e) {
    console.error('[iclock] command listener', (e as Error).message);
    queueWatch.delete(deviceId);
  }
  return w;
}
/** An "Open door" that couldn't reach the device quickly must never fire later (e.g. when an
 *  offline device reconnects hours afterwards): unlock requests expire after this long unsent. */
const UNLOCK_MAX_AGE_MS = 30_000;
async function takeCommands(fs: Firestore, deviceId: string, meter: Meter) {
  const w = watchQueue(fs, deviceId, meter);
  const due = Date.now() - (lastCommandCheck.get(deviceId) ?? 0) >= (w?.healthy ? Math.max(COMMAND_SAFETY_MS, COMMAND_CHECK_MS()) : COMMAND_CHECK_MS());
  if (!w?.pending && !due) return [];
  if (w) w.pending = false;
  lastCommandCheck.set(deviceId, Date.now());
  const snap = await devRef(fs, deviceId).collection('commands').where('status', '==', 'queued').limit(5).get();
  meter.read('commands', Math.max(1, snap.size));
  // More may be waiting (5 per poll): look again on the very next poll instead of in 10 seconds
  if (snap.size) { lastCommandCheck.set(deviceId, 0); if (w) w.pending = true; }
  const lines: string[] = [];
  const batch = fs.batch();
  for (const d of snap.docs.sort((a, b) => (a.get('createdAt')?.toMillis?.() ?? 0) - (b.get('createdAt')?.toMillis?.() ?? 0))) {
    if (d.get('type') === 'unlock_door') {
      const created = d.get('createdAt')?.toMillis?.() as number | undefined;
      if (!created || Date.now() - created > UNLOCK_MAX_AGE_MS) {
        batch.update(d.ref, { status: 'failed', error: 'Expired — the device didn’t collect it within 30 seconds, so it was not sent', doneAt: FieldValue.serverTimestamp() });
        continue;
      }
    }
    const text = commandText({ type: d.get('type') as CommandType, pin: d.get('deviceUserId'), name: d.get('name') });
    if (!text) { batch.update(d.ref, { status: 'failed', error: 'Not a valid command', doneAt: FieldValue.serverTimestamp() }); continue; }
    // 9 digits starting with 9: our range, so results can be told apart from the old server's
    const id = String(900_000_000 + (Math.floor(Date.now() / 10) % 99_000_000) + lines.length);
    lines.push(`C:${id}:${text}`);
    batch.update(d.ref, { status: 'sent', commandId: id, sentAt: FieldValue.serverTimestamp() });
  }
  if (snap.size) { await batch.commit(); meter.write('commands', snap.size); }
  return lines;
}

/**
 * The device's answers to OUR commands. "Return=0" means the device carried the command out;
 * anything else is a failure, reported with the device's own code. For fingerprint enrolment a
 * successful answer means the device accepted the request — the enrolment itself is confirmed
 * only by the device reporting the fingerprint (or a fingerprint-verified scan).
 */
async function recordResults(fs: Firestore, deviceId: string, results: ReturnType<typeof parseCommandResults>, meter: Meter) {
  for (const r of results) {
    const snap = await devRef(fs, deviceId).collection('commands').where('commandId', '==', r.id).limit(1).get();
    meter.read('results', Math.max(1, snap.size));
    const d = snap.docs[0];
    if (!d) continue;
    const ok = r.ret === '0';
    const batch = fs.batch();
    batch.update(d.ref, { status: ok ? 'done' : 'failed', returnCode: r.ret, doneAt: FieldValue.serverTimestamp() });
    const type = String(d.get('type'));
    const uid = d.get('deviceUserId') as string | undefined;
    const ident = uid ? await fs.collection('biometricIdentities').doc(`${deviceId}_${uid}`).get() : null;
    if (ident) meter.read('results');
    if (ident?.exists) {
      if (type === 'enroll_fp') {
        // Never downgrade a confirmed enrolment because of a later answer
        if (ident.get('enrollment') !== 'confirmed') batch.update(ident.ref, ok ? { enrollment: 'device_accepted', enrollmentError: null } : { enrollment: 'failed', enrollmentError: `Device answered ${r.ret}` });
        if (!ok) audit(batch, fs, 'Fingerprint enrolment failed on the device', 'ENROLLMENT_FAILED', ident, { deviceUserId: uid ?? null, returnCode: r.ret });
      }
      if (type === 'add_user' && !ok) batch.update(ident.ref, { status: 'SYNC_FAILED', lastSyncAttemptAt: FieldValue.serverTimestamp(), lastSyncError: `Device answered ${r.ret}` });
    }
    if (type === 'unlock_door') audit(batch, fs, ok ? 'Door released by the device' : 'Door release refused by the device', ok ? 'DOOR_UNLOCKED' : 'DOOR_UNLOCK_FAILED', null, { returnCode: r.ret });
    else audit(batch, fs, ok ? 'Device command carried out' : 'Device command failed', ok ? 'DEVICE_COMMAND_SUCCESS' : 'DEVICE_COMMAND_FAILED', ident?.exists ? ident : null, { command: type, deviceUserId: uid ?? null, returnCode: r.ret });
    await batch.commit();
    meter.write('results', 2 + (ident?.exists && (type === 'enroll_fp' || (type === 'add_user' && !ok)) ? 1 : 0) + (ident?.exists && type === 'enroll_fp' && !ok ? 1 : 0));
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────
/**
 * Diagnostics. Every request gets a full log line (Vercel → Logs, search "adms"). The Firestore
 * contact record (admsDiagnostics/{SN}) is written:
 *   • at once for anything meaningful — a non-2xx answer (refused upload, old server unreachable),
 *     a result of OUR commands, a handshake (device (re)start), or the first request after a quiet
 *     spell (> DIAG_RECORD_MS since the last write);
 *   • otherwise at most every DIAG_RECORD_MS per device per server instance.
 * Request counts, the old server's command verbs and the relay's own Firestore usage are totalled
 * in memory meanwhile and added in that write, so the stored totals stay exact.
 * The device polls every 3–4 s; writing each request used ~18,000 writes a day on its own.
 */
const DIAG_RECORD_MS = () => Number(process.env.ADMS_ROUTINE_RECORD_MS ?? 300_000);
const lastRecord = new Map<string, number>();
const pendingCounts = new Map<string, Record<string, number>>();
const verbTotals = new Map<string, Map<string, number>>();
async function observe(fs: Firestore | null, s: RequestSummary, o: Outcome, urgent = false) {
  logLine(s, o);
  if (!fs) return;
  const key = s.sn || '?';
  const kind = requestKind(s.method, s.path, s.table);
  const counts = pendingCounts.get(key) ?? {};
  counts[kind] = (counts[kind] ?? 0) + 1;
  pendingCounts.set(key, counts);
  if (o.upstreamCommands?.length) {
    const t = verbTotals.get(key) ?? new Map<string, number>();
    for (const v of o.upstreamCommands) { const [verb, n] = v.split(' ×'); t.set(verb, (t.get(verb) ?? 0) + Number(n)); }
    verbTotals.set(key, t);
  }
  // (Notes alone don't count: an unregistered serial polls every few seconds too — its note is
  // recorded on the first request and then every DIAG_RECORD_MS, which is enough to spot a typo)
  const meaningful = urgent || o.status < 200 || o.status >= 300 || kind === 'handshake';
  if (!meaningful && Date.now() - (lastRecord.get(key) ?? 0) < DIAG_RECORD_MS()) return;
  lastRecord.set(key, Date.now());
  const t = verbTotals.get(key);
  if (t?.size) { o = { ...o, upstreamCommands: [...t].map(([v, n]) => `${v} ×${n}`) }; verbTotals.delete(key); }
  pendingCounts.delete(key);
  const usage = takeUsage(key);
  const write = recordContact(fs, s, o, { counts, usage });
  await Promise.race([write, new Promise((r) => setTimeout(r, 2000))]).catch((e) => {
    console.error('[iclock] diagnostics', (e as Error).message);
    // Not lost: put the totals back for the next write
    const back = pendingCounts.get(key) ?? {};
    for (const [k, n] of Object.entries(counts)) back[k] = (back[k] ?? 0) + n;
    pendingCounts.set(key, back);
    returnUsage(key, usage);
    lastRecord.delete(key);
  });
  console.log(JSON.stringify({ adms: true, kind: 'firestore usage', sn: s.sn, since: 'last record', requests: counts, usage }));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const started = Date.now();
  // The path as the device sent it (forwarded unchanged), and its name without the ".aspx" some
  // firmwares add — this X2008 calls /iclock/getrequest.aspx — for our own handling
  const rawPath = String(req.query.path ?? '').replace(/^\/+/, '') || 'cdata';
  const path = rawPath.replace(/\.aspx$/i, '');
  const sn = String(req.query.SN ?? req.query.sn ?? '');
  const table = String(req.query.table ?? '');
  const body = req.method === 'POST' ? await rawBody(req) : null;
  const text = body ? body.toString('utf8') : '';
  const summary = summarize({ method: req.method ?? 'GET', path: rawPath, query: req.query, headers: req.headers, body: text, bodyBytes: body?.length ?? 0 });
  const fsDiag = firestore();

  // Never forward an upload whose body we failed to read: the old server could acknowledge
  // "nothing" and the device would drop those scans. Refusing makes the device send them again.
  const declared = Number(req.headers['content-length'] ?? 0);
  if (req.method === 'POST' && declared > 0 && (body?.length ?? 0) === 0) {
    await observe(fsDiag, summary, { status: 503, upstreamStatus: null, durationMs: Date.now() - started, crmDeviceId: null, forwarded: false, note: `body not received (declared ${declared} bytes) — refused, device will retry` });
    res.status(503).send('Try again');
    return;
  }

  // Remote self-test: answered here — never forwarded, never touches devices, members or scans
  if (sn === PROBE_SN) {
    const reply = path === 'cdata' && req.method === 'GET' ? ownHandshake(sn) : 'OK';
    await observe(fsDiag, summary, { status: 200, upstreamStatus: null, durationMs: Date.now() - started, crmDeviceId: null, forwarded: false, note: 'self-test' });
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(reply);
    return;
  }

  const fs = sn ? fsDiag : null;
  const meter = meterFor(sn || '?');
  const deviceId = fs ? await deviceIdFor(fs, sn, meter).catch(() => '') : '';

  // 1) Command results: ours are handled here; everything else goes to the old server
  let upstreamBody = body;
  let oursOnly = false;
  let oursSeen = false;   // a result of a CRM command: always worth recording
  if (path === 'devicecmd' && body) {
    const results = parseCommandResults(text);
    const ours = results.filter((r) => OUR_ID.test(r.id));
    if (ours.length && fs && deviceId) await recordResults(fs, deviceId, ours, meter).catch((e) => console.error('[iclock] results', e));
    oursSeen = ours.length > 0;
    const theirs = results.filter((r) => !OUR_ID.test(r.id));
    oursOnly = ours.length > 0 && theirs.length === 0;
    upstreamBody = Buffer.from(theirs.map((r) => r.line).join('\n') + (theirs.length ? '\n' : ''));
  }

  // 2) The old server's answer (the device only moves on when it has one)
  let reply: { status: number; type: string; date: string | null; body: Buffer };
  if (!HAS_UPSTREAM || oursOnly) {
    reply = { status: 200, type: 'text/plain', date: null, body: Buffer.from(path === 'cdata' && req.method === 'GET' ? ownHandshake(sn) : 'OK') };
  } else {
    try {
      reply = await forward(req, rawPath, upstreamBody);
    } catch (e) {
      console.error('[iclock] old server unreachable:', (e as Error).message);
      if (fs && deviceId) {
        await devRef(fs, deviceId).update({ lastError: 'The old attendance server didn’t answer; the device will retry' }).catch(() => {});
        meter.write('heartbeat');
        errorShown.add(deviceId);   // the next good request clears it at once
      }
      await observe(fsDiag, summary, { status: 503, upstreamStatus: null, durationMs: Date.now() - started, crmDeviceId: deviceId || null, forwarded: false, note: `old server unreachable: ${(e as Error).message}` });
      res.status(503).send('Try again');   // nothing acknowledged → the device re-sends later
      return;
    }
  }

  const upstreamText = reply.body.toString('utf8');
  // 3) Record on the way through — never delays or changes the old system's reply on failure
  if (fs && deviceId) {
    try {
      await heartbeat(fs, deviceId, meter);
      if (path === 'cdata' && req.method === 'POST' && reply.status < 300) {
        if (table === 'ATTLOG') await ingestScans(fs, deviceId, parseAttlog(text), { meter });
        if (table === 'OPERLOG' || table === 'USERINFO' || /(^|\n)USER /.test(text)) await recordUsers(fs, deviceId, parseUsers(text), meter);
        await recordFingerprints(fs, deviceId, parseFingerprintPins(text), meter);
      }
      if (path === 'getrequest') {
        const mine = await takeCommands(fs, deviceId, meter);
        if (mine.length) {
          const theirs = reply.body.toString('utf8').trim();
          reply.body = Buffer.from([...(theirs && theirs !== 'OK' ? [theirs] : []), ...mine].join('\n') + '\n');
        }
      }
    } catch (e) {
      console.error('[iclock] recording failed:', (e as Error).message);
    }
  }

  // Which commands the OLD server is sending (verbs only) — evidence of whether it rewrites users
  const upstreamCommands = path === 'getrequest' && HAS_UPSTREAM && !oursOnly ? commandVerbs(upstreamText) : [];
  await observe(fsDiag, summary, {
    ...(upstreamCommands.length ? { upstreamCommands } : {}),
    status: reply.status, upstreamStatus: HAS_UPSTREAM && !oursOnly ? reply.status : null, durationMs: Date.now() - started,
    crmDeviceId: deviceId || null, forwarded: HAS_UPSTREAM && !oursOnly,
    ...(sn && fs && !deviceId ? { note: `no CRM device has serial ${sn.toUpperCase()}` } : !sn ? { note: 'request without a serial (SN)' } : {}),
  }, oursSeen);
  res.setHeader('Content-Type', reply.type);
  if (reply.date) res.setHeader('Date', reply.date);
  res.setHeader('Cache-Control', 'no-store');
  res.status(reply.status).send(reply.body);
}

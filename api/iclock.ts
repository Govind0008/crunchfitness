import type { IncomingMessage } from 'node:http';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { firestoreOrNull } from './_lib/firebase.js';
import { ingestScans } from './_lib/ingest.js';
import { PROBE_SN, logLine, recordContact, summarize, type Outcome, type RequestSummary } from './_lib/diagnostics.js';
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
const deviceCache = new Map<string, { id: string; at: number }>();
async function deviceIdFor(fs: Firestore, sn: string) {
  const hit = deviceCache.get(sn);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.id;
  const snap = await fs.collection('gyms').doc(GYM).collection('devices').where('serialNumber', '==', sn.toUpperCase()).limit(1).get();
  const id = snap.docs[0]?.id ?? '';
  deviceCache.set(sn, { id, at: Date.now() });
  return id;
}
const devRef = (fs: Firestore, deviceId: string) => fs.collection('gyms').doc(GYM).collection('devices').doc(deviceId);

let lastBeat = 0;
async function heartbeat(fs: Firestore, deviceId: string, extra: Record<string, unknown> = {}) {
  if (!Object.keys(extra).length && Date.now() - lastBeat < 60_000) return;
  lastBeat = Date.now();
  await devRef(fs, deviceId).update({ lastSeenAt: FieldValue.serverTimestamp(), lastError: null, connection: 'relay', ...extra });
}

/** The device's users (IDs and names only) for the CRM's Match users screen. */
async function recordUsers(fs: Firestore, deviceId: string, users: ReturnType<typeof parseUsers>) {
  if (!users.length) return;
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
  if (n) await batch.commit();
  await devRef(fs, deviceId).update({ usersSeenAt: FieldValue.serverTimestamp() });
}

/** A fingerprint saved on the device for a linked user: enrolment is complete. */
async function recordFingerprints(fs: Firestore, deviceId: string, pins: string[]) {
  if (!pins.length) return;
  const snaps = await fs.getAll(...pins.map((p) => fs.collection('biometricIdentities').doc(`${deviceId}_${p}`)));
  const batch = fs.batch();
  let n = 0;
  snaps.forEach((s) => { if (s.exists && s.get('status') !== 'REMOVED' && s.get('status') !== 'DISABLED') { batch.update(s.ref, { status: 'SYNCED', enrolledAt: FieldValue.serverTimestamp(), lastSyncedAt: FieldValue.serverTimestamp(), lastSyncError: null, updatedAt: FieldValue.serverTimestamp() }); n++; } });
  if (n) await batch.commit();
}

/** Queued CRM commands → "C:<id>:<command>" lines (at most a few per poll). */
async function takeCommands(fs: Firestore, deviceId: string) {
  const snap = await devRef(fs, deviceId).collection('commands').where('status', '==', 'queued').limit(5).get();
  const lines: string[] = [];
  const batch = fs.batch();
  for (const d of snap.docs.sort((a, b) => (a.get('createdAt')?.toMillis?.() ?? 0) - (b.get('createdAt')?.toMillis?.() ?? 0))) {
    const text = commandText({ type: d.get('type') as CommandType, pin: d.get('deviceUserId'), name: d.get('name') });
    if (!text) { batch.update(d.ref, { status: 'failed', error: 'Not a valid command', doneAt: FieldValue.serverTimestamp() }); continue; }
    // 9 digits starting with 9: our range, so results can be told apart from the old server's
    const id = String(900_000_000 + (Math.floor(Date.now() / 10) % 99_000_000) + lines.length);
    lines.push(`C:${id}:${text}`);
    batch.update(d.ref, { status: 'sent', commandId: id, sentAt: FieldValue.serverTimestamp() });
  }
  if (snap.size) await batch.commit();
  return lines;
}

async function recordResults(fs: Firestore, deviceId: string, results: ReturnType<typeof parseCommandResults>) {
  for (const r of results) {
    const snap = await devRef(fs, deviceId).collection('commands').where('commandId', '==', r.id).limit(1).get();
    const d = snap.docs[0];
    if (!d) continue;
    await d.ref.update({ status: r.ret === '0' ? 'done' : 'failed', returnCode: r.ret, doneAt: FieldValue.serverTimestamp() });
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────
/** Diagnostics for every request: a log line always, and the per-serial "last contact" record
 *  when Firestore is available. Never delays the device by more than a moment, never throws. */
async function observe(fs: Firestore | null, s: RequestSummary, o: Outcome) {
  logLine(s, o);
  if (!fs) return;
  await Promise.race([recordContact(fs, s, o), new Promise((r) => setTimeout(r, 2000))]).catch((e) => console.error('[iclock] diagnostics', (e as Error).message));
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
  const deviceId = fs ? await deviceIdFor(fs, sn).catch(() => '') : '';

  // 1) Command results: ours are handled here; everything else goes to the old server
  let upstreamBody = body;
  let oursOnly = false;
  if (path === 'devicecmd' && body) {
    const results = parseCommandResults(text);
    const ours = results.filter((r) => OUR_ID.test(r.id));
    if (ours.length && fs && deviceId) await recordResults(fs, deviceId, ours).catch((e) => console.error('[iclock] results', e));
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
      if (fs && deviceId) await devRef(fs, deviceId).update({ lastError: 'The old attendance server didn’t answer; the device will retry' }).catch(() => {});
      await observe(fsDiag, summary, { status: 503, upstreamStatus: null, durationMs: Date.now() - started, crmDeviceId: deviceId || null, forwarded: false, note: `old server unreachable: ${(e as Error).message}` });
      res.status(503).send('Try again');   // nothing acknowledged → the device re-sends later
      return;
    }
  }

  // 3) Record on the way through — never delays or changes the old system's reply on failure
  if (fs && deviceId) {
    try {
      await heartbeat(fs, deviceId);
      if (path === 'cdata' && req.method === 'POST' && reply.status < 300) {
        if (table === 'ATTLOG') await ingestScans(fs, deviceId, parseAttlog(text));
        if (table === 'OPERLOG' || table === 'USERINFO' || /(^|\n)USER /.test(text)) await recordUsers(fs, deviceId, parseUsers(text));
        await recordFingerprints(fs, deviceId, parseFingerprintPins(text));
      }
      if (path === 'getrequest') {
        const mine = await takeCommands(fs, deviceId);
        if (mine.length) {
          const theirs = reply.body.toString('utf8').trim();
          reply.body = Buffer.from([...(theirs && theirs !== 'OK' ? [theirs] : []), ...mine].join('\n') + '\n');
        }
      }
    } catch (e) {
      console.error('[iclock] recording failed:', (e as Error).message);
    }
  }

  await observe(fsDiag, summary, {
    status: reply.status, upstreamStatus: HAS_UPSTREAM && !oursOnly ? reply.status : null, durationMs: Date.now() - started,
    crmDeviceId: deviceId || null, forwarded: HAS_UPSTREAM && !oursOnly,
    ...(sn && fs && !deviceId ? { note: `no CRM device has serial ${sn.toUpperCase()}` } : !sn ? { note: 'request without a serial (SN)' } : {}),
  });
  res.setHeader('Content-Type', reply.type);
  if (reply.date) res.setHeader('Date', reply.date);
  res.setHeader('Cache-Control', 'no-store');
  res.status(reply.status).send(reply.body);
}

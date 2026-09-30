import { FieldValue, type Firestore } from 'firebase-admin/firestore';

// Diagnostics for traffic from biometric devices (ADMS). Every request is summarised — never
// stored in full — so we can see exactly what the device sends without keeping biometric data:
// fingerprint/face template lines are counted, their contents never logged or saved.

/** A reserved serial for remote self-tests. Requests with it are answered by the relay itself:
 *  never forwarded to the old server, and never touch devices, members or scans. */
export const PROBE_SN = 'CRUNCH-PROBE';

const HEADERS = ['user-agent', 'content-type', 'content-length', 'host', 'accept', 'connection', 'transfer-encoding', 'x-forwarded-proto', 'x-vercel-id'];

export interface RequestSummary {
  at: string;
  method: string;
  path: string;
  query: Record<string, string>;
  sn: string;
  table: string;
  remoteIp: string;
  headers: Record<string, string>;
  bodyBytes: number;
  parsed: { attlogLines: number; userLines: number; fingerprintLines: number; operLogLines: number; commandResults: number; otherLines: number };
}

/** What kind of ADMS request this is, in plain words. */
export function requestKind(method: string, rawPath: string, table: string) {
  const path = rawPath.replace(/\.aspx$/i, '');
  if (path === 'cdata' && method === 'GET') return 'handshake';
  if (path === 'cdata' && method === 'POST') return table ? `upload ${table}` : 'upload';
  if (path === 'getrequest') return 'command poll';
  if (path === 'devicecmd') return 'command result';
  return `${method} ${path}`;
}

export function summarize(opts: { method: string; path: string; query: Record<string, unknown>; headers: Record<string, string | string[] | undefined>; body: string; bodyBytes: number }): RequestSummary {
  const query: Record<string, string> = {};
  for (const [k, v] of Object.entries(opts.query)) if (k !== 'path') query[k] = String(Array.isArray(v) ? v[0] : v ?? '').slice(0, 200);
  const headers: Record<string, string> = {};
  for (const h of HEADERS) { const v = opts.headers[h]; if (v) headers[h] = String(Array.isArray(v) ? v[0] : v).slice(0, 200); }
  const xff = opts.headers['x-forwarded-for'];
  const remoteIp = String((Array.isArray(xff) ? xff[0] : xff) ?? opts.headers['x-real-ip'] ?? '').split(',')[0].trim();
  const parsed = { attlogLines: 0, userLines: 0, fingerprintLines: 0, operLogLines: 0, commandResults: 0, otherLines: 0 };
  const table = query.table ?? '';
  for (const line of opts.body.split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (/^(FP|FACE|BIODATA|BIOPHOTO|USERPIC)\b/.test(line)) parsed.fingerprintLines++;   // counted only
    else if (line.startsWith('USER ')) parsed.userLines++;
    else if (line.startsWith('OPLOG')) parsed.operLogLines++;
    else if (opts.path.replace(/\.aspx$/i, '') === 'devicecmd' && line.startsWith('ID=')) parsed.commandResults++;
    else if (table === 'ATTLOG' && /^\S+\t\d{4}-\d{2}-\d{2} /.test(line)) parsed.attlogLines++;
    else parsed.otherLines++;
  }
  return {
    at: new Date().toISOString(), method: opts.method, path: opts.path, query, sn: query.SN ?? query.sn ?? '', table, remoteIp, headers, bodyBytes: opts.bodyBytes, parsed,
  };
}

export interface Outcome { status: number; upstreamStatus: number | null; durationMs: number; crmDeviceId: string | null; forwarded: boolean; note?: string }

/** One JSON line per request in the function logs (Vercel → Logs, search "adms"). */
export function logLine(s: RequestSummary, o: Outcome) {
  console.log(JSON.stringify({ adms: true, kind: requestKind(s.method, s.path, s.table), ...s, ...o }));
}

const RECENT = 25;
/**
 * The latest contact for each serial (admsDiagnostics/{SN}) — written by the server only; the
 * browser has no rule to read or write it and sees it through /api/adms (admins only).
 * Serials the CRM doesn't know are recorded too, so a typo in the device's serial shows up.
 */
export async function recordContact(fs: Firestore, s: RequestSummary, o: Outcome) {
  const key = (s.sn || 'NO-SERIAL').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 60);
  const ref = fs.collection('admsDiagnostics').doc(key);
  const entry = { at: s.at, kind: requestKind(s.method, s.path, s.table), method: s.method, path: s.path, table: s.table, status: o.status, upstreamStatus: o.upstreamStatus, durationMs: o.durationMs, bodyBytes: s.bodyBytes, parsed: s.parsed, remoteIp: s.remoteIp, ...(o.note ? { note: o.note } : {}) };
  await fs.runTransaction(async (tx) => {
    const cur = await tx.get(ref);
    const recent = [entry, ...((cur.get('recent') as unknown[]) ?? [])].slice(0, RECENT);
    const counts = (cur.get('counts') as Record<string, number>) ?? {};
    counts[entry.kind] = (counts[entry.kind] ?? 0) + 1;
    tx.set(ref, {
      sn: s.sn, probe: s.sn === PROBE_SN, crmDeviceId: o.crmDeviceId,
      firstSeenAt: cur.exists ? cur.get('firstSeenAt') : FieldValue.serverTimestamp(), lastSeenAt: FieldValue.serverTimestamp(), lastAt: s.at,
      last: entry, lastUserAgent: s.headers['user-agent'] ?? '', lastRemoteIp: s.remoteIp, pushVersion: s.query.pushver ?? cur.get('pushVersion') ?? '',
      counts, recent,
    });
  });
}

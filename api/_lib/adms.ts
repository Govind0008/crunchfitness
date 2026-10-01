// eSSL / ZKTeco "ADMS" push protocol — the pieces the relay needs. Pure functions only.
//
// The device talks HTTP to its "Cloud Server":
//   GET  /iclock/cdata?SN=…&options=all      handshake (server replies with options/stamps)
//   POST /iclock/cdata?SN=…&table=ATTLOG     scans:  PIN \t YYYY-MM-DD HH:MM:SS \t status \t verify \t …
//   POST /iclock/cdata?SN=…&table=OPERLOG    user changes: "USER PIN=…\tName=…\tPri=…" (+ FP lines we ignore)
//   GET  /iclock/getrequest?SN=…             the server answers with commands ("C:<id>:<command>") or "OK"
//   POST /iclock/devicecmd?SN=…              results: "ID=<id>&Return=<code>&CMD=<name>" per line
//
// Mirrors src/lib/access/index.ts (event key, eligibility, results) — keep the two in step.

export const IST_OFFSET = '+05:30';
const VERIFY: Record<string, string> = { '0': 'password', '1': 'fingerprint', '2': 'card', '3': 'password', '4': 'card', '15': 'face' };
const PIN = /^[A-Za-z0-9_-]{1,24}$/;

export interface Scan { pin: string; time: string; status: string; verify: string }
export interface DeviceUserLine { pin: string; name: string; admin: boolean; hasCard: boolean }

/** ATTLOG body → scans (bad lines are skipped, never guessed). */
export function parseAttlog(body: string): Scan[] {
  return body.split(/\r?\n/).flatMap((line) => {
    const [pin = '', time = '', status = '', verify = ''] = line.split('\t').map((s) => s.trim());
    if (!PIN.test(pin) || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(time)) return [];
    return [{ pin, time: time.length === 16 ? `${time}:00` : time, status, verify: VERIFY[verify] ?? 'unknown' }];
  });
}

/** OPERLOG / USERINFO body → the "USER" lines (fingerprint template lines are ignored on purpose). */
export function parseUsers(body: string): DeviceUserLine[] {
  return body.split(/\r?\n/).flatMap((raw) => {
    const line = raw.replace(/^USER\s+/, '');
    if (!/^PIN=/.test(line) || !raw.startsWith('USER')) return [];
    const f = Object.fromEntries(line.split('\t').map((kv) => { const i = kv.indexOf('='); return [kv.slice(0, i), kv.slice(i + 1)]; }));
    if (!PIN.test(f.PIN ?? '')) return [];
    return [{ pin: f.PIN, name: (f.Name ?? '').trim(), admin: f.Pri === '14', hasCard: !!(f.Card && f.Card !== '0' && f.Card !== '[0000000000]') }];
  });
}

/** Users the device reports a new fingerprint for ("FP PIN=…" lines) — the template itself is never kept. */
export function parseFingerprintPins(body: string): string[] {
  return [...new Set(body.split(/\r?\n/).flatMap((l) => { const m = l.match(/^FP\s+PIN=([A-Za-z0-9_-]{1,24})\t/); return m ? [m[1]] : []; }))];
}

/** Same id as src/lib/access/index.ts deviceEventKey — a scan reported twice is stored once. */
export function eventKey(gymId: string, deviceId: string, pin: string, time: string) {
  return [gymId, deviceId, pin, time.replace(' ', 'T')].map((p) => p.replace(/[^A-Za-z0-9:._-]/g, '_')).join('__');
}
export function toIso(localTime: string) {
  return new Date(`${localTime.replace(' ', 'T')}${IST_OFFSET}`).toISOString();
}

export interface MemberLike { status?: string; membershipEnd?: string | null; accessOverride?: string | null; accessOverrideReason?: string | null }
// Access decisions live in ./access.ts (explicit CRM ownership; legacy users are never denied).

// ── Commands we send to the device (built here, never taken from the browser) ─
export type CommandType = 'query_users' | 'add_user' | 'enroll_fp' | 'unlock_door';
const clean = (s: string) => s.replace(/[\t\r\n=]/g, ' ').trim().slice(0, 24);
export function commandText(c: { type: CommandType; pin?: string; name?: string }): string | null {
  if (c.type === 'query_users') return 'DATA QUERY USERINFO';
  // Remote door release: the device drives its own lock output (ADMS "AC_UNLOCK")
  if (c.type === 'unlock_door') return 'AC_UNLOCK';
  if (!c.pin || !PIN.test(c.pin)) return null;
  if (c.type === 'add_user') return `DATA UPDATE USERINFO PIN=${c.pin}\tName=${clean(c.name ?? '')}\tPri=0\tPasswd=\tCard=\tGrp=1\tTZ=0000000100000000\tVerify=0`;
  if (c.type === 'enroll_fp') return `ENROLL_FP PIN=${c.pin}\tFID=6\tRETRY=3\tOVERWRITE=0`;
  return null;
}
/** Our command ids live in their own range so they never collide with the old server's. */
export const OUR_ID = /^9\d{8}$/;
export interface CommandResult { id: string; ret: string; cmd: string; line: string }
export function parseCommandResults(body: string): CommandResult[] {
  return body.split(/\r?\n/).filter((l) => l.trim()).map((line) => {
    const f = Object.fromEntries(line.split('&').map((kv) => { const i = kv.indexOf('='); return [kv.slice(0, i), kv.slice(i + 1)]; }));
    return { id: f.ID ?? '', ret: f.Return ?? '', cmd: f.CMD ?? '', line };
  });
}

/** Handshake reply when there is no upstream server (after the old software is retired). */
export function ownHandshake(sn: string) {
  return [`GET OPTION FROM: ${sn}`, 'ATTLOGStamp=None', 'OPERLOGStamp=9999', 'ATTPHOTOStamp=None', 'ErrorDelay=30', 'Delay=10',
    'TransTimes=00:00;14:05', 'TransInterval=1', 'TransFlag=TransData AttLog OpLog EnrollUser ChgUser EnrollFP ChgFP UserPic',
    'Realtime=1', 'Encrypt=0'].join('\n');
}

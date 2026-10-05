// POC check #2 (approximation): CPU used by the relay code per request, measured in Node (same
// V8 engine as Workers) with process.cpuUsage(). Node also spends CPU in its HTTP client, which
// Workers don't charge to the request, so these figures are an upper bound.
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import iclock from '../../api/iclock';
import { parseUsers, parseFingerprintPins, parseAttlog } from '../../api/_lib/adms';

const SN = 'JJA1254700696';
const up = http.createServer((req, res) => { let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => res.end(req.url!.includes('getrequest') ? 'C:77:INFO' : `OK: ${b.split('\n').length}`)); }).listen(0);
await new Promise((r) => up.once('listening', r));
process.env.ADMS_UPSTREAM = `http://127.0.0.1:${(up.address() as AddressInfo).port}`;

function call(path: string, method: string, body?: string) {
  const u = new URL(`http://x/iclock/${path}`);
  const query: Record<string, string> = Object.fromEntries(u.searchParams); query.path = u.pathname.replace('/iclock/', '');
  const buf = body ? Buffer.from(body) : null;
  const l: Record<string, ((x?: unknown) => void)[]> = {};
  const req = { method, url: `/api/iclock${u.search}&path=${query.path}`, query, headers: { 'content-length': String(buf?.length ?? 0) },
    on(e: string, cb: (x?: unknown) => void) { (l[e] ??= []).push(cb); if (e === 'end') queueMicrotask(() => { if (buf) l.data?.forEach((f) => f(buf)); l.end?.forEach((f) => f()); }); return req; } };
  const res = { setHeader() { return res; }, status() { return res; }, send() { return res; }, json() { return res; } };
  return iclock(req as never, res as never);
}
async function measure(label: string, n: number, fn: () => Promise<unknown>) {
  await fn();   // warm-up (JIT, device lookup cache, OAuth/emulator connection)
  const c0 = process.cpuUsage(); const t0 = performance.now();
  for (let i = 0; i < n; i++) await fn();
  const c = process.cpuUsage(c0);
  console.log(`${label.padEnd(44)} CPU ${(((c.user + c.system) / 1000) / n).toFixed(2).padStart(7)} ms/request   wall ${((performance.now() - t0) / n).toFixed(1)} ms`);
}

const users: string[] = [];
for (let i = 1; i <= 528; i++) { users.push(`USER PIN=${2000 + i}\tName=MEMBER ${i}\tPri=0\tPasswd=\tCard=\tGrp=1`); users.push(`FP PIN=${2000 + i}\tFID=6\tSize=1000\tValid=1\tTMP=${'A'.repeat(1400)}`); }
const big = users.join('\n') + '\n';
const attlog = Array.from({ length: 20 }, (_, i) => `${3000 + i}\t2026-09-29 18:${String(i).padStart(2, '0')}:00\t0\t1\t0\t0`).join('\n') + '\n';

console.log('— pure parsing (no I/O) —');
await measure('parse 528 users + templates (787 KiB)', 20, async () => { parseUsers(big); parseFingerprintPins(big); });
await measure('parse ATTLOG, 20 punches', 200, async () => { parseAttlog(attlog); });
console.log('— whole relay request (Firestore emulator + fake old server) —');
await measure('command poll (getrequest)', 100, () => call(`getrequest.aspx?SN=${SN}`, 'GET'));
await measure('ATTLOG upload, 20 unknown users', 20, () => call(`cdata.aspx?SN=${SN}&table=ATTLOG&Stamp=1`, 'POST', attlog));
await measure('OPERLOG 528 users + templates (787 KiB)', 3, () => call(`cdata.aspx?SN=${SN}&table=OPERLOG&Stamp=2`, 'POST', big));
up.close(); process.exit(0);

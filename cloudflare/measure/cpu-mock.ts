// CPU of the relay's own JavaScript per request, with the network replaced by instant in-memory
// answers (so Node's HTTP client isn't counted — on Workers, I/O isn't charged as CPU either).
// Still an estimate; the edge measurement (wrangler tail cpuTime) is authoritative.
import iclock from '../../api/iclock';
const SN = 'JJA1254700696';
const stats = { calls: 0, reqBytes: 0, resBytes: 0 };
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input); const body = typeof init?.body === 'string' ? init.body : '';
  stats.calls++; stats.reqBytes += body.length;
  const json = (o: unknown) => { const s = JSON.stringify(o); stats.resBytes += s.length; return new Response(s, { headers: { 'content-type': 'application/json' } }); };
  if (url.includes('/iclock/')) return new Response(url.includes('getrequest') ? 'C:77:INFO' : 'OK: 1', { headers: { 'content-type': 'text/plain' } });
  if (url.endsWith(':beginTransaction')) return json({ transaction: 'dHg=' });
  if (url.endsWith(':commit') || url.endsWith(':rollback')) return json({ writeResults: [] });
  if (url.endsWith(':batchGet')) return json((JSON.parse(body).documents as string[]).map((n) => ({ missing: n })));
  if (url.endsWith(':runQuery')) return json(body.includes('serialNumber') ? [{ document: { name: 'projects/demo-crunch/databases/(default)/documents/gyms/crunch-wakad/devices/dev1', fields: { serialNumber: { stringValue: SN } } } }] : []);
  return new Response('{}', { status: 404 });
}) as typeof fetch;

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
  await fn(); await fn();
  Object.assign(stats, { calls: 0, reqBytes: 0, resBytes: 0 });
  const c0 = process.cpuUsage();
  for (let i = 0; i < n; i++) await fn();
  const c = process.cpuUsage(c0);
  console.log(`${label.padEnd(40)} JS CPU ${(((c.user + c.system) / 1000) / n).toFixed(2).padStart(6)} ms   subrequests ${(stats.calls / n).toFixed(0).padStart(3)}   sent ${(stats.reqBytes / n / 1024).toFixed(0).padStart(4)} KiB`);
}
const users: string[] = [];
for (let i = 1; i <= 528; i++) { users.push(`USER PIN=${2000 + i}\tName=MEMBER ${i}\tPri=0\tPasswd=\tCard=\tGrp=1`); users.push(`FP PIN=${2000 + i}\tFID=6\tSize=1000\tValid=1\tTMP=${'A'.repeat(1400)}`); }
const big = users.join('\n') + '\n';
const small = users.slice(0, 20).join('\n') + '\n';
const punches = (n: number) => Array.from({ length: n }, (_, i) => `${3000 + i}\t2026-09-29 18:${String(i % 60).padStart(2, '0')}:00\t0\t1\t0\t0`).join('\n') + '\n';
await measure('poll', 200, () => call(`getrequest.aspx?SN=${SN}`, 'GET'));
await measure('handshake', 50, () => call(`cdata.aspx?SN=${SN}&options=all&pushver=2.4.1`, 'GET'));
await measure('1 punch', 50, () => call(`cdata.aspx?SN=${SN}&table=ATTLOG&Stamp=1`, 'POST', punches(1)));
await measure('20 punches', 20, () => call(`cdata.aspx?SN=${SN}&table=ATTLOG&Stamp=1`, 'POST', punches(20)));
await measure('10 users + templates', 20, () => call(`cdata.aspx?SN=${SN}&table=OPERLOG&Stamp=2`, 'POST', small));
await measure('528 users + templates (787 KiB)', 10, () => call(`cdata.aspx?SN=${SN}&table=OPERLOG&Stamp=2`, 'POST', big));
process.exit(0);

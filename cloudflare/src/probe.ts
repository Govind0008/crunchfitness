// POC check #1: can a Worker reach the old server (plain HTTP, bare IP, port 5072)?
// Asks only for the front page ("/"), never an ADMS path, so the old CRM can't mistake it for a
// device. Tries fetch() first, then a raw TCP socket (cloudflare:sockets), and reports both.
import { connect } from 'cloudflare:sockets';

export async function probeOldServer(upstream: string) {
  const u = new URL(upstream);
  const result: Record<string, unknown> = { target: `${u.hostname}:${u.port || 80}` };
  const t0 = Date.now();
  try {
    const r = await fetch(`${u.origin}/`, { signal: AbortSignal.timeout(10_000) });
    const text = await r.text();
    result.fetch = { ok: r.ok, status: r.status, server: r.headers.get('server'), bytes: text.length, ...(r.ok ? {} : { body: text.slice(0, 80) }), ms: Date.now() - t0 };
  } catch (e) { result.fetch = { ok: false, error: (e as Error).message, ms: Date.now() - t0 }; }
  const t1 = Date.now();
  try {
    const sock = connect({ hostname: u.hostname, port: Number(u.port || 80) });
    const w = sock.writable.getWriter();
    await w.write(new TextEncoder().encode(`GET / HTTP/1.1\r\nHost: ${u.host}\r\nConnection: close\r\n\r\n`));
    const reader = sock.readable.getReader();
    const { value } = await Promise.race([reader.read(), new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 10_000))]);
    const statusLine = new TextDecoder().decode(value ?? new Uint8Array()).split('\r\n')[0];
    result.tcp = { ok: /^HTTP\/1\.[01] \d{3}/.test(statusLine), statusLine, ms: Date.now() - t1 };
    await sock.close();
  } catch (e) { result.tcp = { ok: false, error: (e as Error).message, ms: Date.now() - t1 }; }
  return result;
}

// Cloudflare refuses fetch() to a bare IP address ("error code: 1003", measured on the edge), and
// the old server is only reachable as http://122.160.158.120:5072. Workers' TCP sockets
// (cloudflare:sockets) can reach it, so requests to IP addresses go through this small HTTP/1.1
// client instead: one request per connection (Connection: close), body sent with Content-Length,
// response read to the end (Content-Length, chunked or close-delimited), size- and time-limited.
import { connect } from 'cloudflare:sockets';

const MAX_RESPONSE = 5 * 1024 * 1024;   // ADMS answers are tiny; a cap protects the Worker
const isIp = (host: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[');

/** Should this URL go over TCP? Bare IP over plain HTTP — or, in local tests, the forced origin. */
export const viaTcp = (url: URL, forcedOrigin: string | null = null, disabled = false) => !disabled && url.protocol === 'http:' && (isIp(url.hostname) || url.origin === forcedOrigin);

function concat(parts: Uint8Array[], size: number) { const out = new Uint8Array(size); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; }
function indexOf(buf: Uint8Array, seq: number[], from = 0) {
  outer: for (let i = from; i <= buf.length - seq.length; i++) { for (let j = 0; j < seq.length; j++) if (buf[i + j] !== seq[j]) continue outer; return i; }
  return -1;
}
function dechunk(body: Uint8Array) {
  const parts: Uint8Array[] = []; let size = 0; let i = 0;
  while (i < body.length) {
    const eol = indexOf(body, [13, 10], i); if (eol < 0) break;
    const n = parseInt(new TextDecoder().decode(body.subarray(i, eol)).split(';')[0], 16);
    if (!Number.isFinite(n) || n === 0) break;
    parts.push(body.subarray(eol + 2, eol + 2 + n)); size += n; i = eol + 2 + n + 2;
  }
  return concat(parts, size);
}

/** The whole exchange races the caller's AbortSignal (the relay passes a 20 s timeout): a stalled
 *  old server ends in a rejection — the relay's "503, retry later" — never in a hung request. */
export function tcpFetch(url: URL, init: RequestInit = {}): Promise<Response> {
  const signal = init.signal;
  if (!signal) return exchange(url, init);
  if (signal.aborted) return Promise.reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', onAbort, { once: true });
    exchange(url, init).then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}

async function exchange(url: URL, init: RequestInit): Promise<Response> {
  const port = Number(url.port || 80);
  const body = init.body == null ? new Uint8Array() : typeof init.body === 'string' ? new TextEncoder().encode(init.body) : new Uint8Array(init.body as ArrayBuffer);
  const headers = new Headers(init.headers);
  if (!headers.has('Host')) headers.set('Host', url.host);
  headers.set('Connection', 'close');
  if (body.length || (init.method ?? 'GET') === 'POST') headers.set('Content-Length', String(body.length));
  let head = `${init.method ?? 'GET'} ${url.pathname}${url.search} HTTP/1.1\r\n`;
  headers.forEach((v, k) => { head += `${k}: ${v}\r\n`; });
  head += '\r\n';

  const socket = connect({ hostname: url.hostname, port });
  const abort = () => { socket.close().catch(() => {}); };
  init.signal?.addEventListener('abort', abort);
  try {
    const w = socket.writable.getWriter();
    await w.write(concat([new TextEncoder().encode(head), body], head.length + body.length));
    w.releaseLock();
    const reader = socket.readable.getReader();
    const parts: Uint8Array[] = []; let size = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      parts.push(value); size += value.length;
      if (size > MAX_RESPONSE) throw new Error('Upstream response too large');
    }
    const raw = concat(parts, size);
    const split = indexOf(raw, [13, 10, 13, 10]);
    if (split < 0) throw new Error('Upstream sent no HTTP header');
    const lines = new TextDecoder().decode(raw.subarray(0, split)).split('\r\n');
    const m = lines[0].match(/^HTTP\/1\.[01] (\d{3})/);
    if (!m) throw new Error('Upstream sent an invalid status line');
    const out = new Headers();
    for (const l of lines.slice(1)) { const c = l.indexOf(':'); if (c > 0) out.append(l.slice(0, c).trim(), l.slice(c + 1).trim()); }
    let payload = raw.subarray(split + 4);
    if (/chunked/i.test(out.get('transfer-encoding') ?? '')) { payload = dechunk(payload); out.delete('transfer-encoding'); }
    else if (out.has('content-length')) payload = payload.subarray(0, Number(out.get('content-length')));
    const status = Number(m[1]);
    return new Response([101, 204, 205, 304].includes(status) ? null : payload, { status, headers: out });
  } finally {
    init.signal?.removeEventListener('abort', abort);
    socket.close().catch(() => {});
  }
}

/** Route bare-IP http:// requests (the old server) over TCP; everything else uses the platform fetch. */
export function installTcpFetch(forcedOrigin: () => string | null = () => null, disabled: () => boolean = () => false) {
  const native = globalThis.fetch.bind(globalThis);
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    return viaTcp(url, forcedOrigin(), disabled()) ? tcpFetch(url, init) : native(input, init);
  }) as typeof fetch;
}

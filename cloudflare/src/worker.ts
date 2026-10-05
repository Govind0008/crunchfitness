// Crunch on Cloudflare Workers: the production server handlers run UNCHANGED — Firestore goes over
// REST (firestore-rest.ts) and Firebase ID tokens are verified with Web Crypto (admin-auth.ts),
// both aliased for firebase-admin in wrangler.toml — and this file adapts a Workers Request into
// the small Vercel req/res surface the handlers use.
//
//   /iclock/*        → the ADMS relay (api/iclock.ts) — what the X2008 calls
//   /api/adms        → access-control service (api/adms.ts): health; admin-only status, attendance
//                      check/repair, self-test, command notify
//   /api/instagram   → Instagram feed proxy (api/instagram.ts), edge-cached
//   /api/sitemap, /sitemap.xml → sitemap (api/sitemap.ts), edge-cached
//   /poc/health      → liveness ("ok", nothing else)
//   /poc/old-server-probe → can the Worker reach the old server? (front page only; 404 unless the
//                      POC_PROBE_KEY secret is set and given as ?key=; used by the cut-over pre-flight)
// Requests to bare IP addresses (the old server) go over TCP sockets: see tcp-fetch.ts.
import iclock, { registerCommandSignal } from '../../api/iclock';
import adms from '../../api/adms';
import instagram from '../../api/instagram';
import sitemap from '../../api/sitemap';
import { probeOldServer } from './probe';
import { installTcpFetch } from './tcp-fetch';

// The old server is a bare IP, which Cloudflare's fetch() refuses (1003): reach it over TCP.
// ADMS_UPSTREAM_TCP=1 forces TCP for the old-server address even when it isn't a bare IP;
// ADMS_UPSTREAM_TCP=0 turns TCP off (local tests: wrangler dev can't open loopback TCP).
// Firestore and Google always use the platform fetch.
installTcpFetch(() => {
  const env = typeof process !== 'undefined' ? process.env : {};
  try { return env.ADMS_UPSTREAM_TCP === '1' && env.ADMS_UPSTREAM ? new URL(env.ADMS_UPSTREAM).origin : null; } catch { return null; }
}, () => typeof process !== 'undefined' && process.env.ADMS_UPSTREAM_TCP === '0');

/**
 * Open-door fast lane (see registerCommandSignal in api/iclock.ts). A raised signal lives in this
 * server instance's memory and in the edge cache of this Cloudflare location (the device and the
 * gym's staff are served from the same nearby location), for 60 s. Taking it clears both.
 * Only a hint: the periodic Firestore check still delivers every command within its expiry.
 */
const raised = new Map<string, number>();
const signalKey = (deviceId: string) => `https://signal.crunch.internal/command-queued/${encodeURIComponent(deviceId)}`;
const edgeCache = () => (typeof caches !== 'undefined' ? (caches as unknown as { default: Cache }).default : null);
registerCommandSignal({
  async raise(deviceId) {
    raised.set(deviceId, Date.now());
    await edgeCache()?.put(signalKey(deviceId), new Response('1', { headers: { 'Cache-Control': 'max-age=60' } }));
  },
  async take(deviceId) {
    const mem = Date.now() - (raised.get(deviceId) ?? 0) < 60_000;
    raised.delete(deviceId);
    const c = edgeCache();
    const hit = c ? !!(await c.match(signalKey(deviceId))) : false;
    if (hit) await c!.delete(signalKey(deviceId));
    return mem || hit;
  },
});

interface Env { POC_PROBE_KEY?: string; PROBE_TARGET?: string }

/**
 * Test settings must never be live next to production credentials: the emulator switches make
 * the server talk to a test database and (FIREBASE_AUTH_EMULATOR_HOST) accept unsigned ID tokens.
 * If any of them is set while the real service-account secret is present, every dynamic request
 * is refused (503 — the device simply retries) until the configuration is fixed.
 */
const EMULATOR_VARS = ['FIRESTORE_EMULATOR_HOST', 'FIRESTORE_EMULATOR_URL', 'FIREBASE_AUTH_EMULATOR_HOST'] as const;
function misconfigured(): string | null {
  const env = typeof process !== 'undefined' ? process.env : {};
  const set = EMULATOR_VARS.filter((k) => !!env[k]);
  return set.length && env.FIREBASE_SERVICE_ACCOUNT ? `Refusing to run: test settings (${set.join(', ')}) are set together with production credentials` : null;
}
type Handler = (req: never, res: never) => Promise<void> | void;

/** Run a Vercel-style handler for this request. */
async function run(handler: Handler, request: Request, url: URL, ctx: ExecutionContext, query: Record<string, string>, internalUrl: string): Promise<Response> {
  const body = request.method === 'POST' ? new Uint8Array(await request.arrayBuffer()) : null;
  const headers: Record<string, string> = {};
  request.headers.forEach((v, k) => { headers[k] = v; });
  // As Vercel would pass them: the caller's address, and the public scheme/host (self-test)
  const ip = request.headers.get('cf-connecting-ip');
  if (ip) headers['x-forwarded-for'] = ip;
  headers['x-forwarded-proto'] = url.protocol.replace(':', '');
  headers['x-forwarded-host'] = url.host;
  // The Node IncomingMessage surface rawBody() reads: 'data' then 'end'
  const listeners: Record<string, ((x?: unknown) => void)[]> = {};
  const req = {
    method: request.method, url: internalUrl, query, headers,
    // The relay answers the device first and records afterwards (see api/iclock.ts, step 4)
    waitUntil: (p: Promise<unknown>) => ctx.waitUntil(p),
    on(event: string, cb: (x?: unknown) => void) {
      (listeners[event] ??= []).push(cb);
      if (event === 'end') queueMicrotask(() => { if (body?.length) listeners.data?.forEach((f) => f(Buffer.from(body))); listeners.end?.forEach((f) => f()); });
      return req;
    },
  };
  // The VercelResponse surface the handlers use
  let status = 200; let sent: BodyInit | null = null; const out = new Headers();
  const res = {
    setHeader(k: string, v: string) { if (k.toLowerCase() !== 'date') out.set(k, v); return res; },
    status(c: number) { status = c; return res; },
    send(b: string | Uint8Array) { sent = typeof b === 'string' ? b : new Uint8Array(b); return res; },
    json(o: unknown) { out.set('Content-Type', 'application/json'); sent = JSON.stringify(o); return res; },
  };
  await handler(req as never, res as never);
  return new Response(sent, { status, headers: out });
}

/** Public GET answers that say `s-maxage` are kept in this location's edge cache for that long
 *  (what Vercel's CDN did for /api/instagram and the sitemap). Never used for /iclock or admin calls. */
async function cachedPublic(request: Request, ctx: ExecutionContext, produce: () => Promise<Response>) {
  const cache = edgeCache();
  const key = new Request(request.url, { method: 'GET' });
  const hit = request.method === 'GET' && cache ? await cache.match(key) : undefined;
  if (hit) return hit;
  const res = await produce();
  const maxAge = Number(res.headers.get('cache-control')?.match(/s-maxage=(\d+)/)?.[1] ?? 0);
  if (cache && request.method === 'GET' && maxAge > 0) {
    const copy = new Response(res.clone().body, res);
    copy.headers.set('Cache-Control', `public, max-age=${maxAge}`);
    ctx.waitUntil(cache.put(key, copy));
  }
  return res;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const problem = misconfigured();
    if (problem) {
      console.error(`[worker] ${problem}`);
      return new Response(JSON.stringify({ error: problem }), { status: 503, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    }
    const q = () => Object.fromEntries(url.searchParams) as Record<string, string>;
    if (url.pathname.startsWith('/iclock/')) {
      const path = url.pathname.replace(/^\/iclock\/?/, '');
      const routed = new URL(url); routed.searchParams.set('path', path);
      return run(iclock as Handler, request, url, ctx, { ...q(), path }, `/api/iclock${routed.search}`);
    }
    if (url.pathname === '/api/adms') return run(adms as Handler, request, url, ctx, q(), `/api/adms${url.search}`);
    if (url.pathname === '/api/instagram') return cachedPublic(request, ctx, () => run(instagram as Handler, request, url, ctx, q(), '/api/instagram'));
    if (url.pathname === '/sitemap.xml' || url.pathname === '/api/sitemap') return cachedPublic(request, ctx, () => run(sitemap as Handler, request, url, ctx, q(), '/api/sitemap'));
    if (url.pathname === '/poc/health') return new Response('ok');
    if (url.pathname === '/poc/old-server-probe') {
      if (!env.POC_PROBE_KEY || url.searchParams.get('key') !== env.POC_PROBE_KEY) return new Response('Not found', { status: 404 });
      return Response.json(await probeOldServer(env.PROBE_TARGET ?? 'http://122.160.158.120:5072'));
    }
    return new Response('Not found', { status: 404 });
  },
};

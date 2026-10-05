# Cloudflare Workers POC: ADMS relay

Proof of concept for `ZERO_COST_PRODUCTION_ARCHITECTURE.md` (option D).

**Production is untouched.** No route, domain, DNS record or device setting points here. A deploy
from this folder would only create `crunch-site.<your-account>.workers.dev`.

## What it is

- The **production relay, unchanged.** `src/worker.ts` imports `api/iclock.ts` (and through it
  `api/_lib/*`) and adapts a Workers `Request` to the small Vercel `req`/`res` surface it uses.
- **Firestore over REST.** `wrangler.toml` aliases `firebase-admin/firestore` to
  `src/firestore-rest.ts`, which covers what the relay uses: refs, get, set (incl. merge), update,
  queries, `getAll`, batches, transactions with retry, `serverTimestamp`, `arrayUnion` and
  `Timestamp`.
- **Credentials.** `src/google-auth.ts` signs the service-account token with Web Crypto and caches it
  for about 55 minutes.
- **No realtime listener on Workers.** The relay runs with `ADMS_COMMAND_LISTEN=0` and checks for
  queued commands every 15 s (`ADMS_COMMAND_CHECK_MS`). That's inside Open Door's 30 s expiry, but
  slower than today's about 4 s. The "notify" fast lane in the report is **not built yet**.
- **`/poc/old-server-probe`** asks the old server for its front page only (never an ADMS path), by
  `fetch()` and by raw TCP, and reports which works. It needs `?key=` matching the `POC_PROBE_KEY`
  secret.
- **Bundle:** 61 KiB, 17 KiB gzipped. The free limit is 3 MB.

## Results so far

**Phase 2 (edge validation) supersedes this table: see `PHASE_2_VALIDATION.md`.** In short: the
old server is reachable from Cloudflare only over TCP (`fetch()` to a bare IP gets error 1003; the
Worker now uses `src/tcp-fetch.ts` for it); polls use 1–2 ms of edge CPU; the device is answered
before recording (`waitUntil`).

### Phase 1 (superseded)

| # | Check | Result |
|---|---|---|
| 4 | Firestore REST port runs the relay unchanged | **PASS (local).** `tests/events/cloudflare-relay-poc.spec.ts`: 7/7 scenarios in Cloudflare's runtime (workerd via `wrangler dev`) against the Firestore emulator and a fake old server: handshake, punches (CRM, legacy and unknown), retry idempotency, user list without templates, command delivery and result split, Open Door + expiry, old server down → 503, 528-user upload. **PASS (production, read-only):** the Web Crypto token and REST client read the live device record and query. |
| 2 | CPU within 10 ms (free plan) | **Partly.** Measured in Node (same V8; includes Node's HTTP client, so an upper bound): poll **3.6 ms**, 20-punch upload 11.5 ms, parse of the 787 KiB user list 3.6 ms, **whole 528-user upload 73 ms**. Polls (96% of traffic) fit. The rare full user-list upload probably doesn't. **Must be measured on the real edge (below).** |
| 1 | Worker reaches `http://122.160.158.120:5072` | **Not run yet: needs a Cloudflare account.** Run the probe (below). TCP sockets to arbitrary public IPs and ports are documented as allowed. |
| 3 | X2008 accepts Cloudflare TLS | **Not testable without pointing the device here (a production change).** The device already does TLS 1.2 with SNI to Vercel, which Cloudflare's edge supports, so the risk is low. Prove it on cut-over day, with rollback ready. |

## Run locally

```bash
cd cloudflare && npm install          # wrangler (dev tool only)
# from the repo root, with the emulator suite:
npx firebase-tools emulators:exec --project demo-crunch --only auth,firestore,storage \
  'npx playwright test -c playwright.events.config.ts tests/events/cloudflare-relay-poc.spec.ts --project=desktop'
```

## The two checks that need your Cloudflare account (free, no card)

```bash
cd cloudflare
npx wrangler login
npx wrangler secret put POC_PROBE_KEY            # any random string
npx wrangler deploy                               # → https://crunch-site.<account>.workers.dev
curl "https://crunch-site.<account>.workers.dev/poc/old-server-probe?key=<POC_PROBE_KEY>"
```

- **Check 1:** `fetch.ok` or `tcp.ok` true means the Worker can reach the old server.
- **Check 2:** only once the probe passes, and only with the **self-test serial**, never the real
  device. Add `FIREBASE_SERVICE_ACCOUNT` as a secret for a **separate test Firebase project**, replay
  the 528-user upload against the workers.dev URL, and read the CPU time per request in Workers Logs
  or Metrics.
- **Afterwards:** `npx wrangler delete` removes it.

## Open items before any production use

- **Large uploads over the CPU limit.** If the real-edge measurement confirms it, the Worker should
  record big user lists in chunks across requests (or skip the CRM copy and note it). It must never
  fail the device's request, or the device would retry the same upload forever.
- **Command fast lane** (notify endpoint) for about 4 s Open Door instead of up to 15 s.
- **Throttle state** in the Cache API instead of isolate memory.
- **`/api/adms`, `/api/instagram` and `/api/sitemap`** on the Worker. `/api/adms` needs ID-token
  verification without the Admin SDK (Google's public JWKS + Web Crypto).
- **A dedicated, least-privilege service account** for the Worker.

# Cloudflare ₹0 architecture: Phase 2 validation

5 October 2026. Validation only.

**Production was not touched:** no DNS change, no X2008 change, no old-server change, no production
Firebase write, no rules change, no Vercel change, no commit or push.

**Edge tests ran on a *temporary* Cloudflare preview account** (`wrangler deploy --temporary`, a
documented Cloudflare feature "intended for AI agents and other first-time deployment flows").
- It used no login and none of Crunch's accounts or domains.
- Its data was a local Firestore emulator and a fake old server, reached through temporary
  Cloudflare quick tunnels.
- The Worker was **deleted** afterwards (its URL now returns 404), and the tunnels, emulator and
  fake server were stopped.

Labels: **MEASURED-EDGE** (Cloudflare's own `cpuTime`/`wallTime` per request, from `wrangler tail`),
**MEASURED-LOCAL**, **ESTIMATED**.

---

## 1. Old server connectivity

| Path from the Cloudflare edge | Result (MEASURED-EDGE) |
|---|---|
| `fetch("http://122.160.158.120:5072/")` | **Refused by Cloudflare:** HTTP 403, body `error code: 1003` (direct IP access not allowed), 1–2 ms. The request never leaves Cloudflare. |
| TCP socket (`cloudflare:sockets`) → `122.160.158.120:5072`, `GET /` | **Works:** `HTTP/1.1 200 OK`, `Server: gunicorn`, 18,083 bytes, **177–250 ms**, no timeouts, 5 of 5 attempts |

- **Consequence:** the relay's normal `fetch()` can't reach the old server from Cloudflare. The POC now
  routes **bare-IP `http://` requests only** through a small HTTP/1.1-over-TCP client
  (`src/tcp-fetch.ts`). Firestore and Google keep using `fetch()`. `api/iclock.ts` is unchanged by
  this.
- **TCP client self-test on the edge,** against a public echo service (httpbin.org) on a bare IP:
  - POST body echoed **byte for byte**, including tabs and newlines as ADMS uses;
  - query string preserved;
  - **chunked** response decoded;
  - **timeout** honoured at exactly 1.5 s.
- **Only the old server's front page was requested.** No ADMS path, command, user or configuration
  was sent to it.
- **Not testable without production:** the old server's answers to real ADMS requests that come
  through Cloudflare. That's checked on cut-over day (section 13).

## 2. Cloudflare CPU per request (MEASURED-EDGE)

The final POC build answers the device first and records afterwards (section 3). Cloudflare counts
the background work in the same `cpuTime`. Production timing settings were used (routine records
every 5 min, heartbeat every 5 min, command check every 15 s).

| # | Request | Request size | n | CPU ms (min–max, median) | Device answered in (client) | Status | Correct result |
|---|---|---|---|---|---|---|---|
| 1 | Poll (`getrequest`) | 0 | 14 | 1–2, **1–1.5** (one 19 ms outlier) | 163 ms | 200 | ✅ |
| 2 | Handshake | 0 | 4 | 4–6, 5 | 180 ms | 200 | ✅ diagnostics recorded |
| 3 | 1 punch (CRM member) | 39 B | 15 | **6–11, 7** | 152 ms | 200 | ✅ event, visit, last-visit |
| 4 | 20 punches (unknown users) | 0.6 KiB | 3 | 5–8, 5 | 142 ms | 200 | ✅ 20 events |
| 5 | Repeated 20-punch upload | 0.6 KiB | 4 | 4–7, 5 | 158 ms | 200 | ✅ **no** new events |
| 6 | 10-user list + templates | 14.6 KiB | 4 | 4–6, 5 | 212 ms | 200 | ✅ |
| 7 | **528-user list + templates** | **772 KiB** | 4 | **16–38, 16** | 674 ms | 200 | ✅ all 528 mirrored over the next polls |
| 7a | 528-user list, no templates | 30 KiB | 3 | 7–12, 9 | — | 200 | ✅ |
| 7b | Polls writing the backlog | 0 | 10 | 1–21, 7 | 270 ms | 200 | ✅ |
| 8 | Command delivery (first request on a fresh instance) | 0 | 2 | 2–25 | 590–934 ms | 200 | ✅ `C:9…:DATA QUERY USERINFO` |
| 9 | Command result | 0.1 KiB | 2 | 8–10 | 315–643 ms | 200 | ✅ `done`; only the old server's line forwarded |
| 10 | Open Door (delivery poll + result) | 0 / 0.1 KiB | 4 | 3–13 | 469–955 ms | 200 | ✅ `AC_UNLOCK` on the next poll (0.5–0.7 s after queueing), then `done` |

- **Responses:** 2–56 bytes (ADMS replies), unchanged from the fake old server's.
- **No request failed.**
- **Firestore operations per request:** the relay's built-in meter was **not reliable** on the edge.
  It counts per server instance, and Cloudflare spread requests over several instances. The
  document counts are the authoritative check:
  - access events 63 → 75 (12 new punches);
  - repeats added 0;
  - device users = 528 + 528 test lists.

  The per-path figures are counted in section 4.

**How Cloudflare enforces the 10 ms limit (VERIFIED in its docs, and observed):**
- The docs say: "Each isolate has some built-in flexibility to allow for cases where your Worker
  infrequently runs over the configured limit. If your Worker starts hitting the limit consistently,
  its execution will be terminated". The error is 1102.
- **Observed:** all about 70 relay requests, including several at 11–38 ms, succeeded.
- **Runaway CPU** (a test route that never ended, because `Date.now()` doesn't advance during pure
  CPU on Workers) got **1102 every time when it ran *before* the response**, but **the client still
  received its 200 in 8 of 9 runs when it ran *after* the response.** That test route was removed
  from the POC afterwards.
- **What this means:** about 25,600 of the device's ~25,700 daily requests are polls at 1–2 ms, and
  about 85 a day are uploads (MEASURED, production). The heavy ones run over the limit only
  occasionally. A rare 528-user upload (16–38 ms) depends on that "infrequent" allowance. With
  answer-first (section 3), going over can only cut the CRM recording short; it can't stop the
  device from getting its answer.

## 3. The 528-user upload

**What the device expects:** the old server's own reply to the upload (for example `OK: 1056`). The
relay already forwards the upload byte for byte and returns that reply unchanged. That doesn't
change.

**What was fixed, in the shared relay (`api/iclock.ts`, uncommitted):**

1. **Identity lookups.** Before, every upload looked up **every** user ID twice (528 IDs →
   **1,056 reads**) to find the few linked in the CRM. Now there is **one query for this device's
   identities** (12 today), matched in memory. Same effects, about 99% fewer reads. This also helps
   Vercel.
2. **Chunked mirror (opt-in, `ADMS_USER_CHUNK`; the Worker uses 100; Vercel's default is unchanged).**
   The first 100 users are written with the upload. The rest go into one backlog document
   (`devices/{id}/userBacklog/pending`, IDs and names only, **no templates**) and are written 100 per
   poll. 528 users finish in about 5 polls (about 20 s).
   - **Idempotent:** merge writes keyed by device user ID.
   - **Nothing lost:** the backlog is durable in Firestore.
   - **Never touches the device.**
   - The device's `usersSeenAt` is stamped when the list is complete.
3. **Answer first (Workers only, via `waitUntil`; Vercel unchanged).** The device gets the old
   server's reply **before** any CRM recording.
   - Our command lines are still added to a poll's reply first, because they must be part of it.
   - A slow or CPU-limited recording can **no longer make the device resend an upload the old server
     already acknowledged**: the retry-forever risk is removed.
   - Measured locally: 528-user answer **336 ms → 34 ms**.
4. **Never stored:** fingerprint templates. Asserted: no `TMP` content in Firestore.
5. **Legacy users:** never modified. Only identities with `managedBy` and the existing statuses are
   updated, exactly as before.

**Remaining CPU risk:** the full-template upload itself still costs 16–38 ms (parsing and copying
772 KiB). With answer-first, the worst case is a CRM mirror that finishes late or needs the next
upload; the device and the old server aren't affected.
- **Not yet known:** how big a *real* X2008 upload is. The device may split large lists into several
  requests.
- **Optional optimisation:** scan only `USER`/`FP PIN=` lines without decoding the template text.

## 4. Firestore REST

| Area | Result |
|---|---|
| Authentication | Service-account JWT signed with **Web Crypto RS256**, verified against the public key; scope `datastore`; **cached**, with a new token after expiry (local test with a short-lived token). **Production, read-only:** one document get and one query succeeded (MEASURED-LOCAL). |
| Reads, writes, queries, updates | `get`, `set` (incl. merge), `update` (field paths), `delete`, `where`/`orderBy`/`limit`, `getAll` → `batchGet`; all edge scenarios correct |
| Transactions | `beginTransaction` + reads + `commit`, **retried on contention**. Two simultaneous punch uploads for the same member and day both landed (no lost update). |
| Transforms | `serverTimestamp`, `arrayUnion` (punch idempotency), `Timestamp` round trip |
| Errors | Failures propagate to the relay's existing handling. The device still gets the old server's reply; recording errors are logged. A malformed upload is forwarded and answered, and nothing is recorded from it. |
| Admin SDK in the Worker | **None.** `firebase-admin/*` is aliased to `src/firestore-rest.ts`, `admin-app.ts` and `admin-auth.ts`. Bundle: **about 69 KiB (19.6 KiB gzipped)**, of a 3 MB free limit. |

Firestore calls per request (MEASURED-LOCAL with a network mock, each run recording its contact
record):

| Request | Firestore calls |
|---|---|
| Poll | 0–1 at production timing (command check every 15 s; heartbeat and contact record every 5 min) |
| Handshake | 3 |
| 1 CRM punch | 6–7 |
| 20 punches | 6–7 (batched) |
| User list | 4–5, plus 1 per 400 users |

## 5. Idempotency

| Repeat | Result |
|---|---|
| Same punch | **One** access event, one visit (`eventIds` unchanged) |
| Same 20-punch upload ×3 | No new events |
| Same user list ×2 | **Fixed:** confirmed identities are no longer rewritten, and `enrolledAt` keeps the real enrolment time. Before this, every re-upload moved it; that bug is in production today. |
| Same command result ×2 | **Fixed:** the second is ignored. Before this, it wrote a second "Door released" activity entry; also in production today. The command status was always right. |
| Same heartbeat or poll | No extra writes (throttled to once per 5 min) |
| Same request repeated | No duplicate members (the relay never creates members); no destructive writes |

## 6. Security

- **Credentials:**
  - **No credentials in source.** `wrangler.toml` has only non-secret settings. The service-account
    key and probe key are Worker **secrets**.
  - The edge-test config with tunnel URLs and the throwaway probe key was local, git-ignored and has
    been deleted.
  - The key is never logged: token errors report only the HTTP status.
- **Never logged:** fingerprint templates (they aren't parsed or stored), private keys or access
  tokens.
- **The test emulator was briefly reachable** through an unguessable quick-tunnel URL. It held only
  throwaway test data and has been shut down.
- **Least-privilege service account (plan):**
  1. Create `crunch-adms-worker@crunch-fitness-blog.iam.gserviceaccount.com`.
  2. Grant only **Cloud Datastore User** (`roles/datastore.user`): Firestore read and write, no
     admin or IAM rights. No Firebase Admin, Storage or Auth roles.
  3. Create one key and store it only as `wrangler secret put FIREBASE_SERVICE_ACCOUNT`. Never put it
     in files, chat or the repository.
  4. Rotate it every 90 days. Remove the Vercel key once Vercel is retired.
  5. **Separately, rotate the broad Admin SDK key** now in `Downloads/`; it has been used for
     read-only checks throughout.
- **`/api/adms` porting:** staff ID-token checks need verification without the Admin SDK (Google's
  public JWKS + Web Crypto). Until then the POC **fails closed** (no admin access).
- **Old server:** its Monitor page is public with no login. That's for its owner.

## 7. Open Door

| Check | Result |
|---|---|
| Command creation → delivery | `unlock_door` sent as `AC_UNLOCK` in the reserved ID range |
| 30 s expiry | A 2-minute-old request was failed and **never sent** (local and edge) |
| Acknowledgement / result | `Return=0` → `done`; the activity entry is written **once** |
| Duplicate protection | A delivered command is never sent again; a repeated result is ignored |
| Delivery time | Edge: 0.5–0.7 s after queueing (a fresh instance checks at once). **Worst case 15 s plus one poll interval (3.6 s) ≈ 19 s, inside the 30 s expiry.** On Vercel today it's about 4 s, via the Firestore listener. |

- **Margin:** 30 − 19 ≈ 11 s. Safe, but slower than today.
- **Recommended before production:** the "notify" fast lane. The admin's Open Door button calls the
  Worker after writing the command, so it goes out on the next poll (about 4 s).
- **Not claimed:** that the door physically opens. That's for the real-device test.

## 8. Missing APIs

| Route | What it does | Node-only APIs | Admin SDK | On Workers | Volume (ESTIMATED) |
|---|---|---|---|---|---|
| `/api/adms` | `health` (public); `status`, `reconcile`, `backfill`, `selftest` (admins: diagnostics, attendance check and repair) | No | Yes: Firestore (→ REST layer, works) **and Auth `verifyIdToken`** | Yes, after porting ID-token verification (JWKS + Web Crypto) | Tens a day |
| `/api/instagram` | Instagram Graph proxy; returns "not configured" today; CDN-cached | No | No | Yes, as is (`fetch` + edge cache) | 1 per cache period |
| `/api/sitemap` | Public events → sitemap XML via Firestore REST (API key); CDN-cached 1 h | No | No | Yes, as is | A few a day |

## 9. Expected Cloudflare usage (ESTIMATED from MEASURED rates)

| Item | Per day |
|---|---|
| X2008 (MEASURED, production) | 25,735 |
| `/api/*` (cached public plus admin) | About 100 |
| Open Door notify (future) | About 20 |
| **Total Worker requests** | **About 25,900/day = 26% of the 100,000/day free limit, 74% headroom** |

- **Peak:** the device's poll rate is constant. Opening time adds uploads, not polls. **Expected daily
  maximum is about 27,000.**
- **Monthly:** about 800,000 Worker requests. The free limit is daily, so monthly isn't a factor.
- **CPU:** polls (99.7% of requests) at 1–2 ms. About 85 uploads a day at 5–16 ms, occasionally
  more; covered by answer-first.
- **Static site on Pages:** assets don't count as Worker requests. Pages free: 500 builds a month,
  25 MiB per file. Static bandwidth: **confirm** on Cloudflare's pricing page before cut-over.

## 10. Expected Firebase usage (ESTIMATED)

| Source | Reads/day | Writes/day |
|---|---|---|
| Relay: command check every 15 s (no listener on Workers) | about 5,800 | — |
| Relay: punches, results, diagnostics, heartbeat, user lists | about 500–1,000 | about 750 (MEASURED today: 731) |
| Admin CRM (with caching) | 3,000–6,000 | 200–500 |
| Public site | 1,500–4,500 | Enquiries |
| **Total** | **about 11,000–17,000 (22–34% of 50,000)** | **about 1,000–1,300 (5–7% of 20,000)** |

- **Headroom:** about 66% on reads, 93% on writes.
- **Saved:** the identity-query fix removes up to about 1,050 reads per full user-list upload.

## 11. Terms (commercial use)

| Provider | Status |
|---|---|
| Cloudflare Free (Workers, Pages, DNS, tunnels for testing) | No commercial-use restriction in the self-serve terms; no card data collected → **valid** |
| Firebase Spark | No commercial restriction stated → **valid** |
| Vercel Hobby | **Non-commercial only → not valid for the gym** (the reason for this migration) |
| Temporary preview account | Used only for testing and deleted. **Production must run on a Cloudflare account owned by Crunch** (a gym or business email), not a personal account. |

## 12. Risks

| Risk | Severity | Mitigation / status |
|---|---|---|
| Real X2008 TLS with Cloudflare | Medium | Untestable without cut-over. The device already does TLS 1.2 with SNI to Vercel, which Cloudflare supports. Prove it at cut-over with instant rollback. |
| Old server's handling of ADMS via the TCP client | Medium | TCP path proven for reachability, POST bodies, chunking and timeouts; ADMS shape proven against the fake server. Real ADMS exchange only at cut-over. |
| Uploads over the 10 ms CPU limit | Medium → low | Answer-first protects the device. The CRM side completes later or on the next upload. Monitor 1102 counts in Workers Metrics. |
| Open Door up to about 19 s | Low | Within the 30 s expiry. Add the notify fast lane. |
| Firestore hard daily cap | Low | 22–34% of reads. A cap stops CRM recording, never the device or the old server. |
| Usage meter inaccurate across instances | Low | Accept, or move counters to a single place (future) |
| DNS move breaks email forwarding | **High if missed** | Copy the 5 MX records and the SPF `TXT` exactly (section 14) |
| Unported `/api/adms` | Medium | The admin attendance check and repair is unavailable until ported. Port before cut-over. |
| Old server single point of failure | Unchanged | Same as today |

## 13. Real-device cut-over checklist (later, not now)

**Before:**
1. Production Cloudflare account owned by Crunch, with the least-privilege service account (section
   6) stored as a secret.
2. Port `/api/adms` (ID tokens), `/api/instagram` and `/api/sitemap`; add the Open Door notify lane;
   build the site on Pages. Full test suite green.
3. Deploy the Worker to `*.workers.dev` and run `/poc/old-server-probe` (TCP `200`) and the
   self-test serial checks against **production Firestore**, reading only.
4. Add the zone to Cloudflare with **every** record copied (section 14), routes `/iclock/*` and
   `/api/*` → Worker. Skip bot protection, WAF challenges and "Always use HTTPS" redirects on
   `/iclock/*`, so the device is never challenged.
5. **Two days before:** lower the TTLs at Namecheap to 300 s. Screenshot or export every record (the
   backup).
6. Confirm the rollback steps (section 14) and who can make them.

**Window** (gym closed, someone at the X2008, someone at a laptop):

7. Switch the nameservers at Namecheap to Cloudflare's. **Keep the X2008 configuration unchanged**:
   it keeps calling `www.crunnchhfitness.com/iclock`.
8. Watch Workers logs for the device's first request: **handshake** (`options=all`). Check the
   old-server reply came back via TCP (status 200, `upstreamStatus` 200).
9. Polls every about 3.6 s: CPU 1–2 ms, no 1102 errors.
10. **Attendance:** a test punch by a CRM test member → the old CRM shows it **and** the new CRM shows
    the visit.
11. **Legacy user** punch → old CRM shows it; new CRM records it as old system or unknown, never
    denied, nothing sent.
12. **Command polling:** queue "Sync user list" → delivered, `Return=0` → `done`.
13. **Open Door command path:** queue it and check delivery and `done` in the CRM. **Physical release
    is checked separately and deliberately.**
14. Keep watching for 30 minutes: errors, 1102s, Firestore usage, the old CRM's monitor.
15. **Any failure → roll back DNS at once** (section 14).

## 14. Rollback

**Current (MEASURED, public DNS, 5 October 2026):**

| Record | Value | TTL |
|---|---|---|
| NS | `dns1.registrar-servers.com`, `dns2.registrar-servers.com` (Namecheap) | 1800 |
| `crunnchhfitness.com` A | `216.198.79.1` (Vercel) | 1800 |
| `www` CNAME | `965a8f4a9ef5707e.vercel-dns-017.com` (Vercel) | 1800 |
| MX | 10 `eforward1/2/3.registrar-servers.com`, 15 `eforward4`, 20 `eforward5` (Namecheap email forwarding) | 1800 |
| TXT (SPF) | `v=spf1 include:spf.efwd.registrar-servers.com ~all` | 1800 |

**Target:** the same names on Cloudflare nameservers. `www` and the apex go to Cloudflare Pages and
the Worker routes; MX and TXT are copied exactly.

**Rollback, fastest first:**
1. **Inside Cloudflare DNS** (nameservers already moved): set the apex `A` back to `216.198.79.1` and
   `www` back to `CNAME 965a8f4a9ef5707e.vercel-dns-017.com`, both **DNS-only (grey cloud)**.
   Effective within the record TTL (300 s if lowered). The Vercel project stays deployed and
   untouched throughout.
2. **Full revert:** at Namecheap, switch the nameservers back to BasicDNS. Propagation can take up to
   24–48 hours, during which some resolvers still use Cloudflare. That's why option 1 is the
   primary rollback, and why Vercel stays live until the move is complete.

**Verify after a rollback:**
- `https://www.crunnchhfitness.com` serves the Vercel site.
- The device's next request appears in Vercel's logs and `admsDiagnostics.lastSeenAt` moves.
- A test punch reaches both CRMs.
- Email forwarding: send a test email.

## 15. Recommendation

**CONDITIONAL GO** for the architecture. **NOT YET READY** for the real-device test.

- **Passed:**
  - Cloudflare → old server, via TCP sockets.
  - Polls well inside CPU limits.
  - All ten request types correct on the real edge.
  - The 528-user list (chunked, nothing lost, no templates).
  - Firestore REST (auth, CRUD, queries, transactions with retry, transforms), including a
    read-only production check.
  - Idempotency (two production bugs found and fixed).
  - Open Door delivery, expiry, result and duplicates.
  - Usage at 26% of the Worker limit and about 22–34% of Firestore reads.
  - Terms valid.
- **Failed, then fixed:**
  - `fetch()` to the old server's IP (error 1003 → TCP client).
  - Retry-forever risk on over-limit uploads (→ answer-first).
  - 1,056 reads per user list (→ one query).
  - Repeated result and re-upload rewrites (→ ignored or skipped).
- **Still needed before the real-device test:**
  1. A Crunch-owned Cloudflare account and a least-privilege service account.
  2. Port `/api/adms` with ID-token verification, plus `/api/instagram` and `/api/sitemap`.
  3. The Open Door notify lane (recommended).
  4. The site on Pages, with static bandwidth terms confirmed.
  5. A complete DNS copy, including MX and SPF.
  6. Review and merge the shared relay changes (they also change Vercel's behaviour for the better:
     fewer reads, idempotency fixes).
- **Only the real device can prove:**
  - X2008 TLS against Cloudflare;
  - the old server's answers to real ADMS requests through the Worker;
  - the physical door release.

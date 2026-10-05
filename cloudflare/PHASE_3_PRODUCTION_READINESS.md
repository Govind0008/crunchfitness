# Cloudflare ₹0 architecture: Phase 3 production readiness

5 October 2026.

**Production was not touched:** no DNS change, no X2008 change, no old-server change, no Firebase
rules or data change, no Vercel change, no commit or push.

**Test deployments used Cloudflare *temporary* preview accounts.** These are documented as
"intended for AI agents and other first-time deployment flows"; they're unclaimed and expire within
60 minutes. Both previews were **deleted** after testing (their URLs now return 404).

Labels: **MEASURED** (observed in this phase), **ESTIMATED**, **NEEDS YOUR ACTION** (requires the
gym's accounts).

---

## 1. Completed work

| Area | What was done | Evidence |
|---|---|---|
| **`/api/adms` ported** | Runs **unchanged** on Workers. Staff ID tokens are verified **without the Admin SDK** (`src/admin-auth.ts`): RS256 signature against Google's published Firebase keys (cached), issuer, audience, expiry, issue time and user ID, the same checks as the Admin SDK. Unsigned tokens are accepted **only** when the Auth emulator is configured. `node:net` / `node:dns` (used by the admin self-test) work through `nodejs_compat`. | `tests/events/cloudflare-api-poc.spec.ts` 6/6: public `health` reveals nothing sensitive; `status`/`reconcile`/`notify` refuse **no token, a non-admin, and a forged token**; an admin gets status and the attendance check; bad input refused. Token checks run against **Google's real keys**: forged signature, unknown key, unsigned token outside the emulator, wrong audience, wrong issuer and expired are all refused. |
| **`/api/instagram`** | Runs as is; its answers are kept in the edge cache for the handler's own `s-maxage` (as Vercel's CDN did). Still "not configured" today, so no external calls. | Spec + preview: `503 not_configured`, `s-maxage=3600` |
| **`/api/sitemap` + `/sitemap.xml`** | Runs as is, edge-cached. **Fixed the domain:** the sitemap, canonical links, `robots.txt` sitemap line, social-preview images and structured data pointed at `www.crunchfitness.fitness`, **which doesn't exist (NXDOMAIN)**. That bug is live in production today. They now use `www.crunnchhfitness.com`. | Preview sitemap `<loc>https://www.crunnchhfitness.com/…`; public SEO tests pass |
| **Open Door notify lane** | Admin "Open door" now also calls `/api/adms?check=notify` (admin-only, carries no command text). On Workers that raises a **hint** (in memory, plus the edge cache of that Cloudflare location, 60 s), and the device's next poll reads the queue at once. **Firestore stays the only source of truth**; the 15 s periodic check remains the fallback. On Vercel, notify is a harmless no-op (the listener already does this). | Local Workers runtime, with the periodic check set to **10 minutes**: without notify not delivered; **with notify delivered on the very next poll** (117 ms later); delivered once; a notify with nothing queued sends nothing; a **stale** Open Door is failed and never sent even when notified |
| **Website on Cloudflare** | One Worker holds the site (**static assets**: free and unlimited), `/iclock/*`, `/api/*` and `/sitemap.xml`. SPA fallback for every route. `_headers` reproduces `vercel.json` caching (Cloudflare build only). | Preview: **public suite 72/72 passed** (desktop + mobile, incl. SEO and the "Find your plan" test). **Admin UI suites served by the Worker: 94/94 passed.** Crawl of 19 routes × 2 devices: **0 console errors, 0 failed requests** apart from the same expected items as on Vercel (section 3). |
| **DNS inventory and plan** | Full public-DNS inventory; record-by-record mapping; Cloudflare zone settings; rollback | `DNS_MIGRATION_CHECKLIST.md` |
| **Cut-over runbook** | Prerequisites, pre-flight, step-by-step window, separate hardware test, rollback | `REAL_DEVICE_CUTOVER_RUNBOOK.md` |
| **Boot-loader flaky test** | Root cause: the test held database requests by never answering them, and after recovery `unroute()` only applies to *new* requests, so the held ones stayed pending until Firestore's retry backoff. Under full-suite load that sometimes exceeded 15 s. Fix: on recovery the held requests are **released** (`route.continue()`), which models "the database comes back" faithfully. **Assertions unchanged.** | Full suite, section 3 |
| **Shared relay fixes (verified)** | (1) answer the device first, on platforms with `waitUntil` (Workers); (2) chunked, idempotent user-list processing; (3) repeated user lists don't change `enrolledAt`; (4) repeated results don't duplicate "Door released" | Relay, access-control and attendance suites (**Vercel path, `waitUntil` absent**) pass; Cloudflare relay suite 11/11 |
| **Monitoring** | Workers Logs enabled in `wrangler.toml` (free: 200,000 events a day, 3 days) | — |

## 2. Remaining work

| # | Item | Owner |
|---|---|---|
| 1 | **Crunch-owned Cloudflare account** (gym email, 2FA, a second admin) | **NEEDS YOUR ACTION** |
| 2 | **Dedicated service account** `crunch-adms-worker` with only `roles/datastore.user` (commands in section 9), then `npm run verify:sa` | **NEEDS YOUR ACTION** (needs IAM rights on the Firebase project) |
| 3 | **Namecheap zone export** (public DNS can't list a zone completely) | **NEEDS YOUR ACTION** |
| 4 | **Email decision:** Namecheap forwarding is documented only for Namecheap DNS, so moving to Cloudflare Email Routing (free) needs the list of forwarding rules | **NEEDS YOUR ACTION** (the list is only in Namecheap) |
| 5 | **Backup** of the CRM collections (Spark has no managed export: a JSON export to the owner's storage) | **NEEDS YOUR ACTION** (personal data; kept by the owner, not in temporary storage) |
| 6 | Deploy the production Worker build to the Crunch account's `workers.dev` and run the runbook pre-flight (B1–B4) | After 1–2 |
| 7 | **Notify lane on the real edge:** the edge-cache layer works only on a custom domain (the cache API does nothing on `workers.dev`). Confirm at cut-over; the 15 s fallback covers it either way. | Cut-over |
| 8 | Review and merge the shared code changes (they also improve Vercel) | You |

## 3. Test results

| Run | Result |
|---|---|
| Full emulator suite (Vercel path; includes the access-control, payments, admin, relay, rules, receipts, caching and Cloudflare specs) | **256 passed, 0 failed** (119 skipped: device-specific). The boot-loader "slow start" test now passes in the full run. |
| Cloudflare relay spec (Workers runtime) | 11/11 |
| Cloudflare API spec (Workers runtime) | 6/6 |
| Admin UI suites served by the Worker (static assets + `/api` on Workers) | 94 passed, 0 failed (64 skipped: device-specific) |
| Public suite against the Cloudflare preview (production Firebase, read-only) | **72 passed, 0 failed** (2 skipped) |
| Crawl, preview vs Vercel, 19 routes × desktop/mobile | **0 console errors on real pages; identical to Vercel.** Expected items on both: the home page's Instagram "not configured" 503, and the Founders page aborting an optional video that isn't deployed. |
| Typecheck (app + all four API handlers) | Pass |
| Build | Pass: 169 files, JS 587 KB gzipped, CSS 28 KB gzipped |
| Lint, changed files | 0 errors. 2 warnings: existing `react-hooks/exhaustive-deps` in `Chatbot.tsx`, where only the website address string changed. Whole repo: the usual 15 (5 errors, 10 warnings), all pre-existing. |

**Test-environment note:** this machine's VS Code windows use about 65,000 file watchers (the per-user
limit is 65,536), so the suite's Vite dev server ran with `CHOKIDAR_USEPOLLING=1`. That only
affects how the test server notices file changes.

## 4. DNS inventory status

- **Done (public DNS):**
  - NS: Namecheap.
  - Apex `A 216.198.79.1` and `www CNAME …vercel-dns-017.com` (Vercel).
  - **5 MX** (`eforward1–5.registrar-servers.com`, 10/10/10/15/20) and **SPF**
    `v=spf1 include:spf.efwd.registrar-servers.com ~all`.
  - **No** AAAA, CAA, DMARC, DKIM (27 selectors checked), verification records or common
    subdomains.
  - Today, the apex and `http://` both 308 to `https://www.…`; TLS 1.3 with Let's Encrypt.
- **Important finding:** Namecheap documents free email forwarding only "for all the domains pointed
  to our BasicDNS, PremiumDNS, or FreeDNS systems". Moving the nameservers to Cloudflare therefore
  needs an email decision. **Recommended: Cloudflare Email Routing (free)**, recreating each rule.
- **Why the nameservers must move:** a Worker on `www` needs the zone on Cloudflare. The alternative
  CNAME setup needs the paid Business plan.
- **Still needed:** the Namecheap zone export (NEEDS YOUR ACTION). Details in
  `DNS_MIGRATION_CHECKLIST.md`.

## 5. Website (static assets) status

**Why one Worker instead of a separate Pages project:**
- Cloudflare's docs state static-asset requests are **free and unlimited** for both.
- A single Worker keeps the site, `/iclock`, `/api` and the sitemap in one deployment, with the
  routes declared in one file (`run_worker_first`). Only those paths count as Worker requests.

**Limits (VERIFIED, official docs):**

| | Free plan | This site |
|---|---|---|
| Files per version | 20,000 | 169 |
| Size per file | 25 MiB | largest is the 6.5 MB About video |
| Worker requests | 100,000 a day; a Worker-first path over the limit gets **429** (documented) | about 26% |

- **Temporary accounts are stricter (5 MiB per file),** so the preview left out the video and one
  unused 6.3 MB photo. Production on the real free plan isn't affected.
- **Checks passed:** every route and deep link returns 200 (SPA fallback); hashed assets
  `immutable`; images 1-day cache; sitemap; `robots.txt` (admin and portals disallowed); Firebase
  Auth and Firestore from the browser unchanged (same project, same rules).

**Bandwidth (MEASURED on the live site): the About page transfers 78 MB per visit on Vercel today.**
That's the 77.5 MB video. The re-encoded 6.5 MB file (in this worktree, uncommitted) fixes it on
either host.

## 6. Worker status

- **The bundle:**
  - relay, `/api/adms`, Instagram, sitemap;
  - the REST Firestore layer, Web Crypto auth and the TCP client for the old server;
  - **95.5 KiB (26.9 KiB gzipped)**, of a 3 MB limit.
- **Settings:** `nodejs_compat` and `global_fetch_strictly_public`, the latter so the admin self-test
  can call its own public URL.
- **No secrets in configuration.** `FIREBASE_SERVICE_ACCOUNT` and `POC_PROBE_KEY` are secrets.
- **Proven on the edge in Phase 2:**
  - old server over TCP;
  - polls at 1–2 ms CPU;
  - all request types;
  - answer-first.

## 7. `/api/adms` status

**Ported and tested (section 1).**

| Check | Who | Data |
|---|---|---|
| `health` | Public | Reveals nothing sensitive |
| `status` | Admin | Reads `admsDiagnostics` and devices |
| `reconcile` | Admin | Reads punches, attendance, members and trainers |
| `backfill` | Admin, POST | Writes attendance only |
| `selftest` | Admin, POST | Self-test serial only |
| `notify` | Admin, POST | Hint only |

- **Fails closed:** no service account → 503 "Recording isn't set up"; bad or missing token → 401.
- **Required by** the admin's Access pages (connection diagnostics, attendance check and repair,
  device self-test).

## 8. Open Door status

| Property | Status |
|---|---|
| 30 s expiry | Unchanged; stale commands are failed and never sent (also when notified) |
| One-time delivery | A delivered command is never sent again |
| Idempotent result, no duplicate "Door released" | Yes (Phase 2 fix) |
| Fails closed | Notify is admin-only and only a hint; without it, the periodic check (15 s) still delivers |
| Latency | **About 4 s typical**, as today on Vercel: the next poll after notify (local runtime). **Worst case about 19 s** if the hint is lost (15 s check + 3.6 s poll), inside the 30 s expiry. |
| Physical door release | **Not proven.** It's a separate hardware test (runbook §D) |

## 9. Service account and security

**Plan (NEEDS YOUR ACTION; no service account was created):**

```bash
gcloud iam service-accounts create crunch-adms-worker --project crunch-fitness-blog \
  --display-name "Crunch ADMS Worker (Cloudflare)"
gcloud projects add-iam-policy-binding crunch-fitness-blog \
  --member "serviceAccount:crunch-adms-worker@crunch-fitness-blog.iam.gserviceaccount.com" \
  --role roles/datastore.user          # Firestore documents read/write — nothing else
gcloud iam service-accounts keys create ./crunch-adms-worker.json \
  --iam-account crunch-adms-worker@crunch-fitness-blog.iam.gserviceaccount.com
cd cloudflare && SA_FILE=../crunch-adms-worker.json npm run verify:sa   # read-only: one get + one query
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT < ../crunch-adms-worker.json
shred -u ../crunch-adms-worker.json                                     # never keep, commit or paste it
```

**Why `roles/datastore.user` is enough:** the Worker only uses Firestore document operations (get,
batchGet, runQuery, runAggregationQuery, commit, beginTransaction, rollback). ID-token checks use
Google's **public** keys, so no Auth admin role is needed. Spark supports IAM service accounts; no
billing is needed.

**Already verified with the existing key (read-only):**
- token signing and refresh;
- expired-token recovery (a forced short-lived token is refreshed);
- production get and query.

**Then rotate the broad Admin SDK key** now in `Downloads/`.

**Secret handling (MEASURED):**
- Scanning every changed and new file found **no private keys, tokens, claim URLs, tunnel URLs or
  probe keys**.
- The only key in source is the site's **public** Firebase web key, in the unchanged
  `api/sitemap.ts`, which is by design.
- Local-only files (preview configs, `.wrangler/`, `node_modules/`, built test scripts) are
  git-ignored, and the preview configs were deleted.
- **Never committed:** service-account JSON, `.dev.vars`, Worker secrets, Cloudflare API tokens or
  claim URLs, `tests/fixtures/*.xlsx`.
- **Never logged:** fingerprint templates, private keys and access tokens (token errors report only
  the HTTP status).

## 10. Firebase status

- **Unchanged:** project, rules, data, indexes.
- **Measured relay use on Vercel today:** 4,378 reads and 731 writes a day.
- **The shared fixes reduce reads:** a full user-list upload drops from about 1,056 reads to about 12.

## 11. Cost and usage (ESTIMATED from MEASURED rates)

| Metric | Normal day | Expected peak day | Month | Free limit | Margin |
|---|---|---|---|---|---|
| Worker requests | about 26,000 (device 25,735 MEASURED + about 300 API/notify) | about 27,000 | about 800,000 | 100,000 **per day** | **about 73–74%** |
| Static asset requests | any | any | any | Unlimited | — |
| Worker CPU | Polls (99.7%) at 1–2 ms; about 85 uploads at 5–16 ms | Same | — | 10 ms, with "infrequent" overruns allowed | Polls about 80%; uploads covered by answer-first |
| Workers Logs | about 50,000–80,000 events | about 90,000 | — | 200,000 a day | about 55–75% |
| Firestore reads | about 11,000–17,000 | about 20,000 | — | 50,000 a day | **about 60–78%** |
| Firestore writes | about 1,000–1,300 | about 2,000 | — | 20,000 a day | **about 90–95%** |
| Money | **₹0** | ₹0 | ₹0 | — | — |

**Nothing in this design needs paid billing.** Paid options exist but aren't used: Workers Paid,
Firebase Blaze, the Cloudflare Business plan (CNAME setup), Cloud Storage buckets.

## 12. Commercial terms (VERIFIED, official documentation)

| Provider | Status |
|---|---|
| Cloudflare Free (Workers, static assets, DNS, Email Routing) | **No commercial-use restriction** in the self-serve terms. Bars collecting card numbers on free sites; the CRM records only the method. **Valid.** |
| Firebase Spark | No commercial restriction stated. **Valid.** |
| Vercel Hobby | **Non-commercial only:** must be retired as the gym's production host |
| Temporary preview accounts | Testing only; **production must use the Crunch-owned account** |

**Free plans can change.** Re-check these limits and terms before the cut-over and every few months.
The usage margins above leave room for a moderate tightening.

## 13. Real-device prerequisites

See `REAL_DEVICE_CUTOVER_RUNBOOK.md` §A.

- **Done:** `/api/adms`, Instagram and sitemap ported; Open Door path validated in the Workers
  runtime; preview validated; public DNS inventory; rollback documented.
- **Not done (NEEDS YOUR ACTION):**
  1. Crunch-owned Cloudflare account;
  2. Dedicated service account;
  3. Production Worker build on that account;
  4. Namecheap zone export;
  5. Email decision and forwarding rules;
  6. MX/SPF verification;
  7. Backup/export;
  8. Monitoring set up;
  9. People booked for the window.

## 14. Rollback plan

- **Fast:** in Cloudflare DNS, point `www` back to the Vercel CNAME and the apex back to
  `216.198.79.1` (DNS only); within the 300 s TTL set ahead of time.
- **Full:** switch the nameservers back to Namecheap BasicDNS, whose zone is kept intact. Up to
  24–48 h.
- **Vercel stays deployed and assigned throughout,** and for 7 days after a successful cut-over.
- Path after a rollback: X2008 → `www.crunnchhfitness.com` → Vercel → old server. Details in
  `DNS_MIGRATION_CHECKLIST.md` §6 and the runbook §E.

## 15. Risks

| Risk | Level | Mitigation |
|---|---|---|
| Email forwarding during the nameserver move | **High if unplanned** | Email decision (Cloudflare Email Routing), all rules recreated, test every address; rollback restores Namecheap MX |
| X2008 TLS with Cloudflare | Medium | Only provable at cut-over; minimum TLS left at 1.0; instant rollback |
| Old server's real ADMS answers through the Worker | Medium | TCP path proven; prove at cut-over |
| Notify edge-cache layer only on a custom domain | Low | In-memory layer plus 15 s fallback, within the expiry |
| Upload CPU overruns | Low | Answer-first; monitor 1102 errors |
| Free-plan terms or limits change | Low–medium | Re-check periodically; margins of 60% or more |
| Firestore hard cap | Low | 22–40% use |
| Personal or temporary infrastructure | — | Production only on the Crunch-owned account |

## 16. Decision

**NOT READY** for the controlled real-device test.

The software side is complete and tested. The remaining blockers are the gym-owned prerequisites
(section 2, items 1–5), which need your accounts. Once they're done and the runbook pre-flight
passes, the next step is **READY FOR CONTROLLED REAL-DEVICE TEST**.

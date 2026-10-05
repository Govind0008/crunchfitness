# Real-device cut-over runbook (FUTURE: do not run yet)

> **Superseded for the cut-over sequence by `FINAL_CUTOVER_RUNBOOK.md`** (nameservers and website as
> two separate phases; the X2008 `workers.dev` test first: `X2008_FINAL_TEST_RUNBOOK.md`). The
> physical Open Door test in §D below still applies.

The controlled test that moves the X2008's traffic from Vercel to Cloudflare. **The X2008's own
configuration doesn't change.** It keeps calling `https://www.crunnchhfitness.com/iclock/…`; only
DNS decides which platform answers.

## A. Prerequisites: every box ticked before the device is touched

| ✓ | Prerequisite | How it's proven |
|---|---|---|
| [ ] | **Crunch-owned Cloudflare account** (a gym email; 2FA on; a second admin added) | Account settings show the gym as owner |
| [ ] | **Dedicated least-privilege service account** `crunch-adms-worker` with only `roles/datastore.user`; key stored only as a Worker secret | `gcloud projects get-iam-policy` shows the single role; `wrangler secret list` shows `FIREBASE_SERVICE_ACCOUNT` |
| [ ] | **Worker production build** deployed to `crunch-site.<account>.workers.dev` (not on the domain) | `/api/adms?check=health` → `"recording": true` |
| [x] | `/api/adms` ported (ID tokens via Web Crypto; fails closed) | `tests/events/cloudflare-api-poc.spec.ts` |
| [x] | Instagram API migrated (edge-cached, same errors) | Same spec, plus the preview |
| [x] | Sitemap migrated (correct domain) | Same spec, plus the preview |
| [~] | Open Door path validated: notify lane delivers on the next poll (locally); periodic fallback 15 s | Re-check on `workers.dev` with the self-test device |
| [x] | Pages / static preview validated (public suite 72/72; crawl clean) | `PHASE_3_PRODUCTION_READINESS.md` |
| [x] | Full DNS inventory (public) | `DNS_MIGRATION_CHECKLIST.md` |
| [ ] | **Namecheap zone export** compared line by line | The export file is kept with the runbook |
| [ ] | **Email decision made** (`DNS_MIGRATION_CHECKLIST.md` §2): **A** Cloudflare Email Routing with every Namecheap forwarding rule recreated and destinations verified, or **B** MX unchanged with Namecheap's written confirmation | The forwarding-rule list is kept with the runbook |
| [ ] | MX verified (matching the chosen option) | `dig MX`; a test email to **every** forwarded address arrives |
| [ ] | SPF verified (matching the chosen option) | `dig TXT` |
| [n/a] | DKIM / DMARC | None exist today; don't add during the cut-over |
| [ ] | Rollback DNS documented **and rehearsed** (TTL 300 s set 48 h earlier) | `DNS_MIGRATION_CHECKLIST.md` §6 |
| [ ] | Vercel deployment preserved (no deletion; domain still assigned) | Vercel dashboard |
| [ ] | Firebase production untouched (rules, data) | — |
| [ ] | **Backup/export completed** (a JSON export of the CRM collections to the owner's storage; Spark has no managed export) | The export file exists, with document counts |
| [ ] | Monitoring ready: Workers Logs open; Workers Metrics (requests, errors, CPU); Firestore Usage; old-CRM monitor page | Open on a screen |
| [ ] | People: one person at the X2008, one at a laptop, the owner reachable | — |
| [ ] | Shared relay fixes merged and live on Vercel for at least a few days (they also run on Cloudflare) | Vercel deployment |

## B. Pre-flight on `workers.dev` (production Firestore, self-test serial only)

1. `GET /api/adms?check=health` → `alive: true`, `recording: true`, `upstreamConfigured: true`.
2. `GET /poc/old-server-probe?key=…` → `tcp.ok: true` (front page only).
3. As an admin, `POST /api/adms?check=selftest` → every step ok. Its TCP and handshake checks use the
   **self-test serial**, never the real device's serial.
4. Workers Metrics: the error rate is 0.

## C. Cut-over window (gym closed; about 60 minutes set aside)

| Step | Action | Pass criterion | If it fails |
|---|---|---|---|
| 1 | Check the Worker is healthy (B1–B4 again) | All ok | Stop |
| 2 | Check old-server reachability (B2) | `tcp.ok` | Stop |
| 3 | Check Firestore (B1 `recording: true`; a self-test contact recorded) | ok | Stop |
| 4 | Check CPU (Workers Metrics; no 1102 errors) | 0 errors | Stop |
| 5 | Check rollback readiness (TTL 300 s live; Vercel healthy) | ok | Stop |
| 6 | **Back up the DNS** (Namecheap export saved; screenshot) | File saved | Stop |
| 7 | **Change the nameservers** at Namecheap to Cloudflare's (records already prepared and compared) | Cloudflare shows the zone "Active" | Roll back (§E) |
| 8 | **The X2008 is not touched** | — | — |
| 9 | Watch Workers Logs for the device's first request (`SN=JJA1254700696`) | Seen within minutes of propagation | Wait up to the TTL, then roll back |
| 10 | **Handshake** (`cdata?options=all`) | 200, the old server's options returned | Roll back |
| 11 | **Attendance:** a CRM test member punches | The old CRM shows it **and** the new CRM shows the visit | Roll back |
| 12 | **Old CRM response:** compare the old CRM's monitor | The device shows "Live (polling)" there | Roll back |
| 13 | **New CRM processing** (`admsDiagnostics` updating; Access → Activity) | ok | Roll back |
| 14 | **Command polling:** Access → Sync user list | Delivered, `Return=0` → done | Roll back |
| 15 | **Open Door command path** (software): queue Open Door with **nobody relying on the door** | Delivered on the next poll; `done` (or a device code) | Roll back if not delivered |
| 16 | **Legacy user** punch | Recorded as old system or unknown; **never denied**; nothing sent | Roll back |
| 17 | **Repeats:** a second punch in the same minute, and a re-sent upload | No duplicates | Investigate |
| 18 | Watch 30 minutes: 1102 errors = 0, Worker errors = 0, Firestore usage normal | ok | Roll back |
| 18a | **Email:** a test email to every forwarded address | All arrive | Fix the Email Routing rules, or roll back |
| 19 | **Any failure** | — | **Roll back DNS at once (§E)** |

## D. Physical Open Door: a separate hardware test

**Run only after C passes, with the owner present and a deliberate decision.** It tests the lock
wiring and the device's `AC_UNLOCK` support, not the software:
1. Someone stands at the door. Press **Open door** once.
2. Note: the time from the press to the device's result; whether the door releases; the result code
   shown.
3. If `Return=0` but no release, it's a wiring or device-setting issue: stop and call the installer.
   Don't retry repeatedly.

## E. Rollback (the rest of the window, or any time later)

1. **Cloudflare DNS:** `www` → CNAME `965a8f4a9ef5707e.vercel-dns-017.com` (DNS only); remove the
   Worker Custom Domain; apex → A `216.198.79.1` (DNS only). With email option A, Cloudflare Email
   Routing keeps forwarding; with option B, MX and TXT are untouched.
2. Check: `https://www.crunnchhfitness.com` serves Vercel; the device's next request shows in Vercel
   logs; `admsDiagnostics.lastSeenAt` moves; a test punch reaches both CRMs; a test email arrives.
3. If Cloudflare itself is unavailable: switch the nameservers back to Namecheap BasicDNS. The zone
   there was never changed. Allow up to 24–48 hours; Vercel stays live throughout.

**Path after a rollback:** X2008 → `www.crunnchhfitness.com` → **Vercel** → old server, exactly as
before.

## F. After a successful cut-over

- **Keep Vercel deployed and assigned for 7 days.** Don't delete it.
- Daily for the first week: Worker errors and 1102 counts, Firestore usage, the old CRM monitor,
  attendance check (Access → Attendance check).
- **Only then:** remove the domain from Vercel. Keep the Vercel project archived for rollback for 30
  more days.

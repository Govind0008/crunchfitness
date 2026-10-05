# Crunch Fitness — ₹0/month production architecture

Investigation only, 5 October 2026. No code, settings, device, old server, DNS or provider plan was
changed. Figures are marked **MEASURED** (from production records), **VERIFIED** (from the provider's
current official documentation, fetched on 5 October 2026) or **ESTIMATED**.

The production-readiness audit referred to in the brief exists only as a chat report, not as a file
in the repository. Its figures are repeated here where they're used.

---

## 1. Executive summary

- **The current architecture can't be ₹0 legitimately.** It fits Vercel Hobby's free quotas (just
  barely), but Vercel's terms restrict Hobby to non-commercial personal use (VERIFIED), and a gym's
  website and CRM is commercial use. Status: **TECHNICALLY WITHIN QUOTA BUT NOT VALID UNDER PLAN
  TERMS.**
- **The component that blocks ₹0 is Vercel hosting itself**, not just the X2008 relay. Moving the
  relay off Vercel isn't enough: the public site and the admin, being commercial, can't stay on Hobby
  either.
- **Recommended ₹0 architecture: Cloudflare (free plan) for everything Vercel does today, and Firebase
  Spark unchanged.**
  - The website and admin app are served as static files from **Cloudflare Pages**.
  - The ADMS relay and three small APIs run as a **Cloudflare Worker** on the same domain.
  - Cloudflare's self-serve terms don't restrict free plans to non-commercial use (VERIFIED). The one
    relevant clause, no collecting card numbers, doesn't apply: the CRM only records "card" as a
    payment method.
  - The free Worker allows 100,000 requests a day (VERIFIED). The device uses about 25,700 (MEASURED),
    so about **26%**.
  - **The X2008 keeps its current address**, `www.crunnchhfitness.com/iclock`. The domain moves; the
    device configuration doesn't.
- **Firebase Spark stays**, with a healthy margin: about 10,000–20,000 reads and 1,000–1,500 writes a
  day (ESTIMATED), against 50,000 and 20,000.
- **Decision: CONDITIONAL GO.** Build a proof of concept with no production changes, and prove 4
  things before any cut-over (section 20):
  1. The Worker can reach the old server on plain HTTP at `122.160.158.120:5072`.
  2. The relay fits Cloudflare's 10 ms CPU limit on the largest device uploads.
  3. The X2008 accepts Cloudflare's TLS.
  4. The Firestore access works over REST, because the Firebase Admin SDK doesn't run in Workers.

---

## 2. Current architecture

```
X2008 (gym, Airtel line 122.183.33.209) ──HTTPS──▶ www.crunnchhfitness.com/iclock/*  (Vercel, bom1)
                                                      │  api/iclock.ts: forward unchanged, reply with old server's answer
                                                      ├──HTTP──▶ old server 122.160.158.120:5072 (custom Python "Device Manager", gunicorn)
                                                      └──Admin SDK──▶ Firestore (throttled diagnostics, punches, commands, results)

Browser ──HTTPS──▶ Vercel (static SPA + /api/adms, /api/instagram, /api/sitemap) ──▶ Firebase Auth + Firestore (client SDK, rules)
```

- **The device** identifies itself as `iClock Proxy/1.09`, push protocol 2.4.1, and calls the `.aspx`
  paths (MEASURED). It must be using HTTPS today, because Vercel answers plain HTTP with a redirect,
  which ADMS devices don't follow.
- **The old server** is a custom Python web app ("Device Manager": Devices, Clients, Employees,
  Attendance, Monitor) on a **different** broadband line from the gym. It answers plain HTTP only;
  HTTPS on port 5072 doesn't connect (MEASURED). **Its monitor page is publicly reachable without a
  login** (MEASURED, front page only, no member data opened). That's a security point for its owner.
- **Vercel functions:** `api/iclock.ts` (the relay), `api/adms.ts` (admin diagnostics, attendance
  check and backfill), `api/instagram.ts` and `api/sitemap.ts`. There are no cron jobs.

## 3. Current cost and usage

| Item | Value | Source |
|---|---|---|
| X2008 requests | **25,735/day**, a poll every **3.6 s** | MEASURED (`admsDiagnostics`, 4.9 days) |
| Relay Firestore use | 4,378 reads and 731 writes/day | MEASURED (relay usage meter, 87 hours) |
| Largest relay read | Safety-net command check, about 3,900/day | MEASURED |
| Whole-app Firestore | About 8,000–15,000 reads and 1,000–1,500 writes/day | ESTIMATED |
| Vercel (whole account, 6 projects) | 147K function calls, 181K CDN requests, 51m 38s active CPU in the current window | MEASURED by you (Vercel dashboard) |
| Device share of Vercel | About 800K function calls and 800K CDN requests a month | ESTIMATED from MEASURED rate |
| Current money cost | ₹0 | Hobby + Spark |

## 4. Vercel analysis

- **Hobby plan terms (VERIFIED, `vercel.com/docs/limits/fair-use-guidelines`, updated September
  2026):** "Hobby teams are restricted to non-commercial personal use only. All commercial usage of the
  platform requires either a Pro or Enterprise plan." Commercial use includes "Advertising the sale of
  a product or service" and "Any method of requesting or processing payment from visitors".
- **Quotas (VERIFIED):**

  | Resource | Hobby limit |
  |---|---|
  | Function invocations | 1,000,000 a month |
  | CDN requests | 1,000,000 a month |
  | Active CPU | 4 hours a month |
  | Provisioned memory | 360 GB-hours a month |
  | Fast data transfer | 100 GB a month |

  Going over pauses the feature until 30 days have passed.
- **Even with the relay removed, the public site and admin can't stay on Hobby.** The remaining load
  would be small (ESTIMATED under 200K CDN requests a month), so the reason is the terms, not the
  quota. Verdict: **TECHNICALLY WITHIN QUOTA BUT NOT VALID UNDER PLAN TERMS.**
- **A hybrid (relay elsewhere, site on Vercel Hobby) is therefore not valid either.**

## 5. Firebase analysis (Spark)

- **Terms:** the Firebase pricing page states no commercial-use restriction for Spark (VERIFIED, no
  such clause found). Spark is valid for this use.
- **Limits (VERIFIED):** 50,000 document reads, 20,000 writes and 20,000 deletes a day; 1 GiB stored.
  These are **hard daily caps**: going over refuses requests until the daily reset, which is what
  happened on 1 October.
- **Expected use under the recommended architecture (ESTIMATED):**
  - Reads: about 10,000–20,000 a day, **20–40% of the cap**.
    - Relay: 5,000–9,000, depending on the command-check interval (section 11).
    - Admin: 3,000–6,000, with the existing caching.
    - Public site: 1,500–4,500 for 100–300 visits at 10–15 reads each.
  - Writes: about 1,000–1,500 a day, **5–8%**.
- **Already optimized; keep as is:** relay throttling, admin caching with refresh on every save, the
  badge interval.
- **Remaining ideas, all small, no functionality removed:**
  - Have `OfferBanner` query only active offers.
  - Run the background prefetch only for pages staff actually open often.
  - Lengthen the relay's command check from 20 s to 30 s *only* together with the fast lane in
    section 11.
- **Not available at ₹0: member photos.** Firebase Storage isn't set up for this project (the
  configured bucket doesn't exist, MEASURED), and new buckets need the paid Blaze plan.
  - ₹0 alternatives: small compressed photos stored inside Firestore (under 100 KB, within the 1 MiB
    document limit, adding reads when shown), or an external free image host such as Cloudinary, which
    already serves team and blog images. Cloudinary's commercial terms: **NEEDS VERIFICATION**.
- **Google Maps reviews:** the Places API needs Google Cloud billing. It's **not in the live build**
  (`TestimonialsSection` is unused, MEASURED). Keep it off for ₹0.

## 6. X2008 traffic analysis

| Request | Purpose | MEASURED rate | Firestore today | Needs old server's answer? | Configurable? |
|---|---|---|---|---|---|
| `GET /iclock/getrequest.aspx` | Command poll and heartbeat | **24,256/day** | None per poll. Heartbeat and diagnostics are written every 5 min; command check via listener plus a 20 s safety net | Yes: the old server's commands | Interval set by the server's handshake `Delay` option (section 7) |
| `POST /iclock/devicecmd.aspx` | Command results | About 1,300/day, mostly the old server's commands | Only for CRM commands: 1 read and 2–4 writes | Yes, except results of CRM-only commands | Follows commands sent |
| `POST /iclock/cdata.aspx?table=ATTLOG` | Punches | About 44/day (batched) | About 3 reads and 1.5 writes per punch | **Yes**: punches are acknowledged only after the old server acknowledges them | Event-driven |
| `POST cdata?table=OPERLOG` / `USERINFO` / `FP` | User list, fingerprint records | About 42/day | Device users and enrolment evidence | Yes | Event-driven |
| `GET /iclock/cdata.aspx?options=all` | Handshake (device start) | About 0.6/day | Diagnostics | Yes: its reply holds the device options | — |
| `POST cdata.aspx` (options) | Device info | About 2/day | Diagnostics | Yes | — |

- **Every request depends on the old server**, except results of CRM-only commands. If the old
  server doesn't answer, the relay returns 503 and the device retries later. Nothing is
  acknowledged, so nothing is lost.
- **Measured wall time** is about 360 ms per request, almost all of it waiting for the old server.

## 7. Existing old server

| Question | Finding |
|---|---|
| What runs there? | A custom Python web app (gunicorn) titled "Device Manager"/"Device Monitor" with Devices, Clients, Employees, Attendance. It's the old CRM and the device's original ADMS server. |
| Paid or owned by Crunch? | **NEEDS VERIFICATION.** It's on a residential/business Airtel line that isn't the gym's line, so it's likely the previous vendor's or the owner's own machine. |
| HTTP or HTTPS? | **HTTP only** on port 5072. HTTPS doesn't connect. |
| Can it run Python? | Yes, it already does. Node is unknown. |
| Could it host the new relay logic? | Technically yes, as Python next to its own ADMS handling. It would need (a) its owner to change its code, (b) the device pointed at it directly, which **changes the device configuration** and **downgrades the device link from HTTPS to HTTP**, and (c) a Firestore service-account key on that machine. |
| Incremental cost | ₹0 if Crunch controls the machine; otherwise depends on a third party. |
| Preserves the old CRM and device behaviour? | Yes, if done by its owner. It was the original setup. |
| Main risks | It isn't Crunch's to change. One home-broadband machine becomes the single point of failure for *both* CRMs. It doesn't solve hosting the website. |
| **Verdict** | **NEEDS VERIFICATION, POSSIBLE BUT RISKY.** Only an option if Crunch owns and can maintain that machine. |

**Polling (Option 3).**
- In the ADMS push protocol, how often the device polls `getrequest` comes from the `Delay` value the
  **server** sends in its handshake reply. The protocol's default is 30 s. The measured 3.6 s suggests
  the old server sends about `Delay=3`. That's **inferred**: its handshake reply isn't recorded today,
  and I didn't send it a fake handshake.

  | `Delay` | Polls/day (ESTIMATED) | Open Door / enrolment start | Attendance |
  |---|---|---|---|
  | 3 (today) | about 24,000 | about 4 s | Unaffected |
  | 10 | about 8,300 | up to about 10 s | Unaffected if the server sets `Realtime=1` (punches are pushed when they happen, not on the poll) |
  | 15 | about 5,600 | up to about 15 s, still inside the 30 s Open Door expiry | Same |
  | 30 (default) | about 2,900 | up to about 30 s: **too slow**, Open Door could expire | Same |

- **Mandatory requests:** the handshake, `getrequest` (it's both the command channel and the
  heartbeat), `cdata` uploads and `devicecmd` results. None can be removed.
- **Configurable:** only the poll interval (`Delay`) and the upload timing options (`TransInterval`,
  `TransTimes`, `Realtime`). All of them come from the *server's* handshake reply, not from the
  device's menus.
- **Recommendation:** it isn't needed for ₹0 under the recommended architecture (26% of the Worker
  limit at today's rate).
  - If ever wanted, `Delay=10` is the safe ceiling for Open Door. It must be agreed with the old
    server's owner, since it slows *their* commands too.
  - First, record the old server's actual handshake reply. That's a small, safe logging change in the
    relay (a future task), so it's known rather than inferred.

## 8. Free hosting candidates

| Candidate | Commercial use | Free limits | Fits about 26K device requests/day? | Card / billing needed | Sleeps? | Classification |
|---|---|---|---|---|---|---|
| **Cloudflare Workers + Pages** | No restriction in the self-serve terms (VERIFIED); no card-number collection on free sites | Workers: 100,000 requests/day, 10 ms CPU each, 50 subrequests, 128 MB (VERIFIED). Pages: 500 builds/month, 20,000 files, 25 MiB per file (VERIFIED) | Yes, 26% | No | No (isolates, near-zero cold start) | **VALID ₹0**, subject to the PoC checks |
| Cloudflare Durable Objects (free) | Same | 100,000 requests/day; 13,000 GB-s/day duration; SQLite only (VERIFIED) | Requests yes. But **a polled object never goes idle**: about 10,800 GB-s/day of 13,000 (ESTIMATED, 83%) | No | — | **POSSIBLE BUT RISKY**; avoid in the hot path |
| Cloudflare KV (free) | Same | 100,000 reads and **1,000 writes/day** (VERIFIED); consistency not stated | — | No | — | Not suitable for Open Door signalling |
| Deno Deploy | **Not stated** on the pricing page | 1M requests/month, 10 h CPU, 20 GiB egress (VERIFIED) | About 800K/month, **80%** | Not stated | — | **POSSIBLE BUT RISKY / NEEDS VERIFICATION** |
| Old server (section 7) | Own machine | — | Yes, it did this before | — | No | **NEEDS VERIFICATION** (ownership) |
| On-site always-on PC at the gym (if one exists) | Own machine | — | Yes | No | Must stay on | **NEEDS VERIFICATION**; needs a device URL change to a LAN address |
| Oracle Cloud Always Free VM | Generally allowed | — | Yes | **Card required** for sign-up; idle-instance reclaim policy (official FAQ returned 403) | No | **POSSIBLE BUT RISKY / NEEDS VERIFICATION** |
| Render free | **"Do not use them for production applications"** (VERIFIED) | 750 h/month; restarts at any time | — | — | Yes, after 15 min idle | **NOT VALID** |
| Netlify free | Not stated | 300 credits/month (VERIFIED), bandwidth at 20 credits/GB | No, function calls would exhaust the credits | — | — | **NOT VALID** for the relay |
| GitHub Pages | **Prohibits** use as hosting for an online business or SaaS (VERIFIED) | 100 GB/month soft limit | No server code | — | — | **NOT VALID** |
| Firebase Hosting (Spark) | Allowed | 10 GB storage, **10 GB/month transfer** (VERIFIED); no functions on Spark | Can't run the relay | No | — | Site only: **POSSIBLE BUT RISKY** (bandwidth) |
| Firebase Cloud Functions / Google Cloud Run | Allowed | Free quotas exist | Yes | **Billing account required** | — | **NOT VALID** (billing required) |
| Vercel Hobby | **Non-commercial only** (VERIFIED) | See section 4 | Yes, barely | No | — | **NOT VALID UNDER PLAN TERMS** |

## 9. Provider terms (commercial use)

| Provider / plan | Commercial gym use allowed? | Evidence |
|---|---|---|
| Vercel Hobby | **No** | Fair-use guidelines, "Commercial usage" (quoted in section 4) |
| Cloudflare Free (Workers, Pages, DNS) | **Yes**: no commercial-use restriction in the self-serve agreement; the free-services clause bars collecting card numbers | cloudflare.com/terms, §2.2.1(h), §2.6 (free services provided without liability) |
| Firebase Spark | **Yes**: no restriction stated | firebase.google.com/pricing |
| Render free | **No** for production | render.com/docs/free |
| GitHub Pages | **No** for an online business | GitHub Pages limits page |
| Deno Deploy free | Unclear | Pricing page silent |

## 10. Comparing the options

| Option | Monthly cost | Commercially valid | X2008 compatible | Attendance | Open Door | Remote enrolment | Old CRM | Firebase impact | Vercel impact | Reliability | Risk | Recommendation |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A. As today (Vercel Hobby, relay + site) | ₹0 | **No** | Yes | Yes | Yes | Yes | Yes | Within Spark | About 80% of quotas from the device | Good | Terms violation | **No** |
| B. Relay moved, site stays on Vercel Hobby | ₹0 | **No** (site is commercial) | Depends | Yes | Yes | Yes | Yes | Same | Small | — | Terms violation | **No** |
| C. Vercel Pro | $20/month | Yes | Yes | Yes | Yes | Yes | Yes | Same | Paid | Good | — | Excluded by the ₹0 requirement (reference only) |
| **D. Cloudflare Pages + Worker relay, Firebase Spark** | **₹0** | **Yes** | Yes, same URL (TLS to be verified) | Yes | Yes (fast lane, section 11) | Yes | Yes, forwarding unchanged | Same or slightly lower | None (Vercel retired) | Good: Cloudflare edge; old server unchanged | PoC items (section 20) | **Recommended** |
| E. Old server hosts the relay; site on Cloudflare Pages | ₹0 if owned | Yes, if owned | Needs a device URL change and HTTP | Yes | Needs old-server code | Needs old-server code | Yes | Same | None | One home line for both CRMs | Ownership, HTTP downgrade | Only if Crunch owns it |
| F. On-site gym PC relay; site on Cloudflare Pages | ₹0 if a PC exists | Yes | Needs a device URL change (LAN) | Yes | Yes | Yes | Yes | Same | None | Power and PC uptime | Hardware upkeep | Fallback to D |
| G. Deno Deploy relay; site on Cloudflare Pages | ₹0 | Unclear | Yes | Yes | Yes | Yes | Yes | Same | None | Good | 80% of its quota; terms unclear | Not recommended |
| H. Reduce polling (`Delay`) | ₹0 | — | Yes | Yes | Slower | Slower | Its commands slower too | Lower | Lower | — | Needs the old server's owner | Optional add-on to D |

## 11. Recommended ₹0 architecture (D)

- **DNS for `crunnchhfitness.com` moves to Cloudflare** (free). The registrar stays; the domain
  renewal is an existing cost, not infrastructure.
- **Cloudflare Pages** serves the built React app (`dist/`) with the same SPA routing and cache
  headers as `vercel.json`. The largest file must stay under 25 MiB; the re-encoded About video is
  6.5 MB.
- **One Cloudflare Worker** on routes `/iclock/*` and `/api/*`:
  - **`/iclock/*`** ports `api/iclock.ts` with the **same behaviour**:
    - forwards every request unchanged and returns the old server's reply;
    - refuses with 503 rather than lose a body;
    - adds only CRM commands from the reserved ID range;
    - sends nothing for legacy or unknown users, and never logs fingerprint templates.
  - **`/api/adms`, `/api/instagram`, `/api/sitemap`**: same handlers. Public responses are cached at
    the edge (Cache API).
- **Firestore access from the Worker uses REST, not the Admin SDK.** That means a dedicated, minimal
  service account, OAuth token signed with WebCrypto and cached for about 55 minutes, and the same
  documents and fields as today. The Firestore emulator speaks the same REST API, so the existing
  relay tests can be pointed at it.
- **Throttling state** (last diagnostics write, pending counts, last command check) moves from
  process memory to Cloudflare's **Cache API**. That's free, and shared within the edge location the
  device always hits (Mumbai).
- **Command fast lane, replacing the Firestore listener** (Workers can't hold one):
  - The admin's "Open door", enrolment and sync buttons, after writing the command to Firestore as
    today, also call `POST /api/adms?check=notify` with the staff member's Firebase ID token. The
    Worker verifies it, then sets a "pending" flag in the Cache API.
  - The next device poll, at most about 3.6 s later, reads Firestore once and delivers.
  - **Safety net:** the Worker still checks Firestore every **15 s** (about 5,800 reads/day). That's
    shorter than Open Door's 30 s expiry, so a lost notify can't make the door command expire unsent.
    The expiry rule stays exactly as it is.
- **Firebase Spark** stays unchanged: rules, data model, Auth.
- **Vercel** is retired once the cut-over is stable (section 16).

## 12. Traffic flow

```
                          ┌───────────────────────────────┐
X2008 ──HTTPS (unchanged URL www.crunnchhfitness.com/iclock/*)
                          │   Cloudflare edge (free)       │
                          │   Worker: ADMS relay           │──HTTP (fetch, or TCP-socket fallback)──▶ old server 122.160.158.120:5072
                          │    • forward unchanged          │◀──────────── reply (passed back to the device unchanged)
                          │    • add CRM commands only      │
                          │    • throttled records          │──REST + OAuth (service account, Worker secret)──▶ Firestore (Spark)
                          └───────────────────────────────┘
Staff/visitors ──HTTPS──▶ Cloudflare Pages (static app) ──client SDK + rules──▶ Firebase Auth + Firestore
Staff "Open door" ──▶ Firestore command doc ──and──▶ Worker /api/adms?check=notify (ID token) ──flag──▶ next device poll
```

## 13. Expected monthly usage (ESTIMATED unless marked)

| Resource | Limit | Expected |
|---|---|---|
| Worker requests/day | 100,000 (VERIFIED) | About 26,000 (device, MEASURED rate) + about 200 API = **26%** |
| Worker CPU per request | 10 ms (VERIFIED) | Polls and forwards about 1–3 ms (fetch waiting doesn't count). OAuth signing about 2–5 ms, once an hour. **Large `USERINFO` uploads (528 users seen) need measuring.** |
| Pages static requests and bandwidth | No cap stated in the docs fetched; **confirm** | About 30–60 requests per visit |
| Firestore reads/day | 50,000 | About 10,000–20,000 (20–40%) |
| Firestore writes/day | 20,000 | About 1,000–1,500 (5–8%) |
| Vercel | — | 0 after retirement |
| Money | — | **₹0** (domain renewal is an existing, non-infrastructure cost) |

## 14. Failure scenarios

| Failure | Effect | Behaviour / mitigation |
|---|---|---|
| Worker daily limit exceeded (Error 1027) | `/iclock` returns an error until midnight UTC | The device keeps punches and retries; nothing is lost, the CRM is delayed. Alert at 70% (Cloudflare analytics, free). At 26% use there's a large margin. |
| Worker CPU limit exceeded on a big upload | That request fails | Must answer 503 so the device retries. If one upload always exceeds the limit, it would retry forever: **PoC blocker #2**. |
| Old server down | Same as today: 503, device retries | No change |
| Firestore daily cap hit | The relay still forwards to the old server; CRM records fail for the rest of the day | Same as today. Keep the 20–40% margin; the attendance check can backfill from stored events afterwards. |
| Cloudflare outage | Site and relay down | The device buffers punches; rollback is a DNS change (section 17) |
| Notify call lost | Open Door delivered by the 15 s safety net | Within the 30 s expiry |
| DNS cut-over mistake | Device can't connect | Low TTL in advance; cut over at a quiet hour with someone at the device; instant rollback |

## 15. Security

- **Credentials:**
  - The service-account key lives only as a **Worker secret**, never in code or frontend.
  - Use a **new, dedicated** service account with Firestore-only permissions, instead of reusing the
    current Admin SDK key from local machines.
  - Rotate the key currently stored in `Downloads/`.
- **The relay keeps today's validation:**
  - the serial must match a registered device;
  - only ADMS paths and methods are handled;
  - a body that wasn't fully received is refused;
  - CRM command IDs are reserved and must match to be accepted;
  - command text is built only from fixed command types;
  - fingerprint templates are never stored or logged.
- **Add at the edge (free WAF):**
  - a rate limit per IP on `/iclock/*`;
  - a request-body size cap;
  - Bot Fight Mode **off** (or skipped) for `/iclock/*`, so the device is never challenged.
- **`notify` endpoint:** verifies the Firebase ID token and the admin role (as `/api/adms` does today);
  it only sets a flag and never accepts command text.
- **Device link:** device → Cloudflare stays HTTPS. Cloudflare → old server is plain HTTP over the
  internet, the **same exposure as today** (Vercel → old server). Only the old server's owner can fix
  that.
- **Old server:** its public, login-free monitor page should be reported to its owner.

## 16. Migration plan (later, after this report is approved)

1. **Proof of concept, no production impact:** a free Cloudflare account; the Worker on
   `*.workers.dev` and the site on `*.pages.dev`.
   - Run the existing relay test-suite against the Worker plus the Firestore emulator.
   - Prove the 4 checks in section 20 with **the relay's self-test serial**, never the real device.
2. Port the relay to the Worker with the same tests passing, and add a notify call to the admin
   command buttons.
3. Add the domain to Cloudflare without switching the nameservers yet. Recreate the DNS records; set
   SSL to Full; skip bot protection for `/iclock/*`.
4. Lower the TTL; keep Vercel serving the domain meanwhile.
5. **Cut over at a quiet hour** (gym closed), with someone at the X2008:
   - switch the nameservers;
   - watch for the device's first `/iclock` request in Worker logs;
   - run the device checklist in section 19.
6. Run both for 7 days with Vercel still deployed (unused). Then remove the domain from Vercel.

## 17. Rollback

- **Before the nameserver switch:** nothing has changed.
- **After it:** point the `www` and apex records back to Vercel inside Cloudflare DNS. That takes
  effect within the TTL; the Vercel project stays untouched for 30 days.
- **If the nameservers themselves must revert:** switch them back at the registrar. That can take up
  to 24–48 hours, so keep Vercel serving throughout.
- **No device setting, old-server setting or Firestore rule changes at any step,** so there's nothing
  else to undo.

## 18. What must NOT change

- **The X2008:** its configuration, server URL and users. No deletes, no disables, no fingerprint
  overwrites.
- **The old server:** its software, configuration and replies, and its command flow to the device.
- **Unknown and legacy device users are never denied.** The new CRM touches only users it created or
  that were explicitly taken over.
- **Relay rules stay as they are:**
  - Open Door's 30 s expiry;
  - the reserved CRM command-ID range;
  - "acknowledge only what the old server acknowledged";
  - "refuse rather than lose a body".
- **Firestore:** the security rules and the data model.
- **Receipts:** stay browser-only PDFs, with no Storage.

## 19. Real-device tests needed

1. The X2008 connects to Cloudflare over HTTPS: handshake, polls, uploads. Check `lastSeenAt`.
2. A punch reaches the old CRM **and** the new CRM's attendance.
3. Open Door: the door releases; latency with the notify path and with the 15 s safety net only.
4. Remote enrolment through the new screens: start, fingerprint captured, "Enrolled (confirmed by the
   device)".
5. A legacy user scans: still recorded as old system or unknown, never denied, nothing sent.
6. A device restart (handshake) and the old server offline for 1 minute: device recovers, nothing
   lost.
7. A full user-list upload (528 users) completes within Worker limits.

## 20. GO / NO-GO

| Decision | Verdict |
|---|---|
| Current architecture as ₹0 production | **NO-GO**: TECHNICALLY WITHIN QUOTA BUT NOT VALID UNDER PLAN TERMS (Vercel Hobby, non-commercial) |
| Vercel Pro / Firebase Blaze | Excluded by the ₹0 requirement |
| **Architecture D (Cloudflare free + Firebase Spark)** | **CONDITIONAL GO**: proceed to a no-impact proof of concept |
| Cut-over to production | **NO-GO until the PoC proves all four:** (1) the Worker reaches `http://122.160.158.120:5072` via `fetch()`, or via the TCP-socket API, which is VERIFIED to allow arbitrary public IPs and ports; (2) the largest real payloads stay inside 10 ms CPU; (3) the X2008 accepts Cloudflare's TLS; (4) Firestore REST port passes the existing relay tests |
| Options E/F (old server or gym PC) | Hold as fallbacks; need ownership or hardware confirmation |
| Polling reduction (H) | Not required; optional later with the old server's owner |

**Components that block ₹0 today:** Vercel Hobby's commercial-use restriction, for the site and admin
as much as for the relay. Firebase is not a blocker.

# Final cut-over runbook: crunnchhfitness.com → Cloudflare

**Status: plan only. Nothing here has been done.** Every step that changes something needs the owner's explicit approval at the time.

This replaces the cut-over sequence in `REAL_DEVICE_CUTOVER_RUNBOOK.md`. That file's prerequisites and the physical Open Door test (its §D) still apply.

**The two-phase plan.** Moving the nameservers and moving the website are separate events. Each has its own rollback, and each is approved separately.

| Phase | What changes | Who notices | Rollback |
|---|---|---|---|
| **A: nameservers** | Namecheap's nameservers → Cloudflare's. The Cloudflare zone holds the **same records** as Namecheap, all **DNS only**. | Nobody: the site, admin and X2008 still go to **Vercel** | Nameservers back to Namecheap (slow, up to 48 h), or fix records in Cloudflare (fast) |
| **B: website and relay** | `www` → the Worker Custom Domain; the apex → a Cloudflare redirect | Everyone (it should be invisible) | Remove the Custom Domain and put the Vercel CNAME and A back (TTL 300 s) |

**Vercel stays deployed, assigned and untouched throughout,** and for at least 7 stable days after Phase B.

Related documents:
- `DNS_CUTOVER_AUDIT.md`: records, labels, owner confirmations
- `PRODUCTION_DOMAIN_READINESS.md`: Worker readiness, zone settings, certificates
- `X2008_FINAL_TEST_RUNBOOK.md`: the device test that must pass first

## A. Pre-cut-over checklist (all ticked before Phase A)
| ✓ | Item | Proof |
|---|---|---|
| [ ] | **X2008 stage 1 on `workers.dev` passed** (section B) | monitor and postcheck summaries in `~/.crunch-x2008/` |
| [ ] | Namecheap zone **exported** and kept | The file |
| [ ] | Cloudflare zone **exported**, identical to Namecheap, every record **DNS only** (grey cloud) | Both files compared line by line |
| [ ] | **Email decision** made: (1) Cloudflare Email Routing with every Namecheap forwarding rule recreated and each destination verified, or (2) keep the `eforward` MX and SPF with Namecheap's **written** confirmation that forwarding keeps working on third-party nameservers | The rule list, or Namecheap's reply |
| [ ] | Every forwarded address has had a test email **before** (baseline) | The emails arrived |
| [ ] | TTL for `@` and `www` lowered to **300 s at Namecheap, 48 h before** | DoH shows TTL ≤ 300 |
| [ ] | Firebase password-reset action URL and API-key referrer restrictions checked | `DNS_CUTOVER_AUDIT.md` §5 |
| [ ] | Search Console verification method known | — |
| [ ] | Firestore backup (a JSON export of the CRM collections to the owner's storage; Spark has no managed export) | The file, with document counts |
| [ ] | Vercel: project and domains untouched; the latest production deployment healthy | Vercel dashboard |
| [ ] | People: one at a laptop, one able to reach the X2008, the owner reachable; a quiet time | — |

## B. X2008 validation requirement
**Phase B must not start until `X2008_FINAL_TEST_RUNBOOK.md` stage 1 has passed.** That means the handshake over HTTPS on port 443 with unchanged settings, steady polling, every answer 200/200, the command queue unchanged, and the switch-back to Vercel confirmed.

If the device only works with **HTTPS off on port 80**, the production plan changes:
- the X2008 is set to HTTP, port 80, `www.crunnchhfitness.com`, during Phase B;
- the zone's HTTP→HTTPS Redirect Rule must exclude `/iclock/*`;
- this is decided and approved before Phase B.

## C. Nameserver change (Phase A)
1. Re-check the Cloudflare zone's records against the Namecheap export: same names, types, values and priorities, **all DNS only**. The email records follow the decision in A.
2. **If Email Routing was chosen:** enable it now, in the Cloudflare zone, and recreate every rule. It takes effect only when the nameservers move.
3. Namecheap → Domain List → Manage → **Nameservers** → Custom DNS: `armfazh.ns.cloudflare.com` and `journey.ns.cloudflare.com`. Save. **The Namecheap zone isn't edited or deleted.** It's the rollback.
4. Write down the time.

## D. Cloudflare verification (Phase A)
| Check | Command / place | Pass |
|---|---|---|
| Delegation | `curl -s "https://dns.google/resolve?name=crunnchhfitness.com&type=NS" \| jq -r '.Answer[].data'` | `armfazh…` and `journey.ns.cloudflare.com` (after propagation; up to 24 h, usually under 1 h) |
| Zone status | Cloudflare → Overview | **Active** |
| Records unchanged | `…type=A` for `crunnchhfitness.com`; `…type=CNAME` for `www.crunnchhfitness.com`; `…type=MX`; `…type=TXT` | `216.198.79.1`; `965a8f4a9ef5707e.vercel-dns-017.com`; the MX/SPF per the email decision |
| Still served by Vercel | `curl -sI https://www.crunnchhfitness.com/ \| grep -i '^server\|^x-vercel'` | `server: Vercel` |
| X2008 still on Vercel | `cd cloudflare && SA_FILE=~/.secrets/crunch-adms-worker.json npm run -s verify:sa` (read-only) | `lastSeenAt` current |

**Hold Phase A for at least 24 hours** before Phase B. Email and DNS should be proven stable on their own.

## E. Website switch (Phase B), then website verification
**Switch (each step approved):**
1. **Remove the test safety switch for production:** from `cloudflare/`, run `npm run build:site && npx wrangler deploy` (**without** `--var`). `npx wrangler versions view <new id>` must **not** list `ADMS_DELIVER_CRM_COMMANDS`.
2. Apply the zone settings in `PRODUCTION_DOMAIN_READINESS.md` §5:
   - Always Use HTTPS **off**;
   - an HTTP→HTTPS Redirect Rule **excluding `/iclock/*`**;
   - Bot Fight Mode **off**;
   - the `/iclock/*` Configuration Rule (Security Level essentially off, Browser Integrity Check off);
   - the rate limit;
   - minimum TLS 1.0.
3. Cloudflare DNS: **delete** `www` CNAME → `965a8f4a9ef5707e.vercel-dns-017.com`. Write the value down; it's the rollback.
4. **Immediately** add the Worker Custom Domain: Workers & Pages → `crunch-site` → Settings → Domains & Routes → Add → Custom Domain → `www.crunnchhfitness.com`. Wait for its certificate to be **Active**.
5. Apex: replace `A @ 216.198.79.1` with `A @ 192.0.2.1` **proxied**, plus a Redirect Rule `crunnchhfitness.com/*` → `https://www.crunnchhfitness.com/${1}` (308, query kept).

**Verify (read-only):**
| Check | Command | Pass |
|---|---|---|
| Served by Cloudflare | `curl -sI https://www.crunnchhfitness.com/ \| grep -i '^server\|^cf-ray'` | `server: cloudflare`, a `cf-ray` |
| Certificate | `openssl s_client -connect www.crunnchhfitness.com:443 -servername www.crunnchhfitness.com </dev/null 2>/dev/null \| openssl x509 -noout -issuer -dates` | A valid issuer and dates. Note the key type. |
| Pages | Open `/`, `/about-us`, `/founders`, `/admin`, `/trainer/login`, `/client/login`, `/marketing/login`, `/checkin` (phone and desktop) | They render; no console errors |
| Assets | `curl -sI https://www.crunnchhfitness.com/assets/<a current file>` | 200, `immutable` |
| Sitemap / robots | `curl -s https://www.crunnchhfitness.com/sitemap.xml \| grep -c '<loc>https://www.crunnchhfitness.com'`; `curl -s https://www.crunnchhfitness.com/robots.txt \| tail -1` | 10; `Sitemap: https://www.crunnchhfitness.com/sitemap.xml` |
| Apex | `curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' 'https://crunnchhfitness.com/about-us?x=1'` | `308 https://www.crunnchhfitness.com/about-us?x=1` |
| Browser HTTP | `curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://www.crunnchhfitness.com/about-us` | 301/308 → `https://…` |
| **HTTP `/iclock` not redirected** | Don't call `/iclock` yourself. Confirm in Cloudflare → Rules that the redirect rule's expression excludes `/iclock/`. | The rule text |

## F. Firebase / API verification (Phase B)
| Check | Command | Pass |
|---|---|---|
| Health | `curl -s 'https://www.crunnchhfitness.com/api/adms?check=health' \| jq -c .` | `alive`, `recording`, `upstreamConfigured` all true |
| Admin-only | `curl -s -o /dev/null -w '%{http_code}\n' 'https://www.crunnchhfitness.com/api/adms?check=status'` | 401 |
| Admin sign-in | Sign in at `/admin` with a real admin account | Dashboard loads; Members and Access lists load |
| Staff sign-ins | Trainer, client and marketing logins | Each signs in |
| Open-door notify path (no door) | **Not now.** It's done with the physical test (`REAL_DEVICE_CUTOVER_RUNBOOK.md` §D), with the owner present. | — |
| Password reset email (if used) | Request one for a staff test account | The link opens and works |

## G. `/iclock` verification (Phase B)
The X2008 isn't touched: it keeps calling `www.crunnchhfitness.com`. DNS now sends it to the Worker within the TTL (≤ 300 s). If its DNS cache holds longer, a device restart picks it up.

| Check | Where | Pass |
|---|---|---|
| Device on the Worker | `cd cloudflare && npx wrangler tail crunch-site --format json \| jq -c --unbuffered 'select(.event.request.url\|test("/iclock")) \| {t:(.eventTimestamp/1000\|strftime("%H:%M:%S")), outcome, http:.event.response.status, path:(.event.request.url\|sub("https://[^/]+";"")\|.[0:60])}'` | Handshake, then polls about every 3–4 s, all `ok`/200 |
| Old server | Its Monitor page | Device live |
| CRM | `/admin/settings/access`; `admsDiagnostics` via `npm run -s verify:sa` | `lastSeenAt` current, no error |
| Vercel quiet | Vercel → Logs → `/api/iclock` | Device requests stop |
| Commands now deliver | Admin → Access → **Sync user list** (no door) | The command goes `sent` → `done` (`Return=0`) |
| A punch | A CRM-linked staff member scans once | It shows in the old CRM **and** once in the CRM (Attendance / Access → Activity) |
| A legacy user punch | An old-system user scans | Recorded as legacy or unknown, **never denied** |

## H. Vercel rollback procedure
**Fast rollback (Phase B → Vercel; minutes):**
1. Cloudflare → `crunch-site` → Domains & Routes: **remove** the Custom Domain `www.crunnchhfitness.com`.
2. Cloudflare DNS: add `CNAME www → 965a8f4a9ef5707e.vercel-dns-017.com`, **DNS only**.
3. Cloudflare DNS: apex back to `A @ 216.198.79.1`, **DNS only**. Remove the placeholder and the apex Redirect Rule.
4. Check:
   - `curl -sI https://www.crunnchhfitness.com/ | grep -i '^server'` → `Vercel`;
   - the X2008 appears in Vercel → Logs → `/api/iclock` within about 5 min (restart the device if it doesn't);
   - `verify:sa` shows `lastSeenAt` moving.
5. Leave the Worker deployed; it's harmless with no domain.

**Full rollback (Phase A → Namecheap; up to 48 h):** Namecheap → Nameservers → **Namecheap BasicDNS**. The Namecheap zone was never changed, so every record, including MX and SPF, is as before. Vercel serves throughout.

**Note on Vercel certificates during a long Cloudflare period:** Vercel renews its certificate for `www` only while DNS points to Vercel. After a rollback weeks later, Vercel may need a few minutes to issue a new one. Plan rollbacks inside the 7-day observation window when possible.

## I. Email / MX verification
**Phase A and after Phase B:**
| Check | Command | Pass |
|---|---|---|
| MX | `curl -s "https://dns.google/resolve?name=crunnchhfitness.com&type=MX" \| jq -r '.Answer[].data'` | The chosen option's MX, all priorities |
| SPF | `…type=TXT` | Exactly one `v=spf1 …` matching the option |
| Delivery | From an outside account (for example Gmail), a test email to **every** forwarded address | Each arrives at its destination inbox, not in spam |
| Replies | Reply from a destination inbox | Arrives |

If any address fails: fix the Email Routing rule, or roll back (H). Don't add DMARC or DKIM during the cut-over.

## J. Monitoring period
| When | What |
|---|---|
| First 60 min after Phase B | The Worker tail (G): every answer 200, 0 exceptions, 0 CPU-limit (1102) errors; the old CRM Monitor; admin Access page |
| Daily, days 1–7 | Cloudflare → `crunch-site` → Metrics: requests, errors, CPU. Workers usage below 100k/day. Firestore → Usage (reads/writes in line with about 4,400/730 a day for the relay). The CRM attendance check (Access → Attendance check). A test email. The old CRM Monitor. |
| Day 7, if all clean | Only then may the domain be removed from Vercel. Keep the Vercel project for 30 more days. |
| Throughout | **Vercel stays deployed and assigned** (rollback) |

## K. Rollback criteria (any one means roll back via H)
- The site or admin is unreachable or broken for over 5 minutes; a certificate error.
- `/api/adms?check=health` isn't `alive` / `recording`.
- The X2008 isn't polling the Worker 10 minutes after Phase B (and a restart didn't help).
- Any 5xx to the device, an old server answer other than 200, or the old CRM showing the device offline for over 5 minutes.
- Punches missing in either CRM, or visits counted twice.
- CRM commands not delivered (`sent` never reaching `done`), or anything delivered twice.
- Worker errors, CPU-limit (1102) errors, or requests near the 100k/day free limit.
- Any forwarded email address not receiving mail (Phase A: fix rules, or full rollback).
- Anything at the door that wasn't asked for.

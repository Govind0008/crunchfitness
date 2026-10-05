# Production-domain readiness: can `crunch-site` serve `www.crunnchhfitness.com`?

**Status: audit only.** No domain was attached, and no route or DNS record was created. Measured on 5 October 2026 against the deployed Worker (version `95c25fe6-c069-481f-a85e-5a93819f7adb`, `https://crunch-site.gsalunke169.workers.dev`), compared with today's Vercel site. No `/iclock` request was sent.

## Verdict
**The website, APIs and assets are ready.** The `/iclock` relay is ready in code and tests but **not yet proven with the real X2008**. Four things must happen before `www` can move:
1. **The X2008 test on `workers.dev` passes** (`X2008_FINAL_TEST_RUNBOOK.md`). This settles the main open question: does the device accept Cloudflare's **ECDSA-only** certificate?
2. **The zone is active** (Phase A of `FINAL_CUTOVER_RUNBOOK.md`). A Worker Custom Domain needs an active zone.
3. **The safety switch is removed** for production: a deploy **without** `--var ADMS_DELIVER_CRM_COMMANDS:0`. With it left on, Open Door, enrolment and user sync would silently never reach the device.
4. **The zone settings in §5 are applied**, especially: no HTTP→HTTPS redirect for `/iclock`, and no bot challenges.

## 1. What the Worker serves (measured)
| Path | Cloudflare (`workers.dev`) | Vercel (`www` today) | Ready? |
|---|---|---|---|
| `/` and SPA routes (`/about-us`, `/founders`, `/admin/…`, `/trainer/login`, `/client/login`, `/marketing/login`, `/checkin`, unknown paths) | 200 `text/html`, `public, max-age=0, must-revalidate` | 200, same cache header | **Yes** |
| `/index.html` | 307 → `/` | 200 | Yes (harmless) |
| `/assets/*` (hashed JS/CSS) | 200, `public, max-age=31536000, immutable` | Same | **Yes** |
| `/images/*`, `/lovable-uploads/*` | `public, max-age=86400, stale-while-revalidate=604800` (`site/_headers`) | Same (`vercel.json`) | **Yes** |
| `/favicon.ico`, `/c-light.png` | 200, `max-age=0, must-revalidate` | Same | **Yes** |
| `/robots.txt` | 200; `Sitemap: https://www.crunnchhfitness.com/sitemap.xml` | 200; `Sitemap: https://www.crunchfitness.fitness/…` (**a domain that doesn't exist**) | **Yes, and better** |
| `/sitemap.xml` (and `/api/sitemap`) | 200 XML, 10 URLs, all on `www.crunnchhfitness.com`; edge-cached 1 h | 200, 10 URLs, all on `www.crunchfitness.fitness` | **Yes, and better** |
| `/api/adms?check=health` | 200 JSON, `no-store`; `recording: true`, `upstreamConfigured: true` | 200, `no-store` | **Yes** |
| `/api/adms?check=status` without a login | 401, `no-store` | 401, `no-store` | **Yes** |
| `/api/instagram` | 503 (no Instagram token configured), cached 1 h at the edge | 503 (not configured there either) | **Yes** (same behaviour) |
| `/api/<anything else>` | 404 | 404 | **Yes** |
| `/poc/health` | 200 `ok` | — | Harmless liveness check |
| `/poc/old-server-probe` | 404 (no key set) | — | **Yes** (closed) |
| Plain `http://` | Served, no redirect (`workers.dev`) | 308 → `https://` | See §5: browsers must be redirected, `/iclock` must not be |
| `/iclock/*` | Relay (`run_worker_first`); 42 local tests; old-server TCP reachability proven; **real device not yet** | Relay | **Pending the X2008 test** |

**Known, inherited, not a blocker:** a missing `/assets/x.js` gets the SPA's HTML with the `immutable` header, on Vercel and on Cloudflare alike. A browser asking for a chunk that no longer exists caches HTML under that name. It's equally true today; fix it separately. Options: `/assets/*` misses return 404, or drop `immutable` on fallback responses.

## 2. Firebase
| Item | Finding | Ready? |
|---|---|---|
| Browser → Firebase (Auth, Firestore, Storage) | Direct from the browser with the Firebase SDK. It doesn't pass through the Worker, so it's unchanged. Auth domain `crunch-fitness-blog.firebaseapp.com`. | **Yes** |
| Worker → Firestore | REST, using the **restricted** service account `crunch-adms-worker@…` (`roles/datastore.user` only) as the secret `FIREBASE_SERVICE_ACCOUNT` | **Yes** (read-only production check passed) |
| Admin API auth (`/api/adms`) | Firebase ID tokens checked against Google's public keys (RS256, issuer, audience, expiry). Fails closed. Tested, including forged tokens. | **Yes** |
| Test-settings guard | The Worker refuses to serve (503) if emulator settings are ever set next to the production secret. None are set. | **Yes** |
| Email/password sign-in on the same hostname | No authorized-domain change needed | **Yes** |
| Password-reset action URL; API-key referrer restrictions | See `DNS_CUTOVER_AUDIT.md` §5 | **NEEDS OWNER CONFIRMATION** |

## 3. Configuration of the live version (`wrangler versions view`)
| Setting | Value now | For production (Phase B) |
|---|---|---|
| `ADMS_UPSTREAM` | `http://122.160.158.120:5072` | Same |
| `ADMS_COMMAND_LISTEN` | `0` (Workers can't hold a Firestore listener; the notify lane is used instead) | Same |
| `ADMS_COMMAND_CHECK_MS` | `15000` | Same |
| `ADMS_USER_CHUNK` | `100` | Same |
| `PROBE_TARGET` | `http://122.160.158.120:5072` | Same |
| **`ADMS_DELIVER_CRM_COMMANDS`** | **`0` (test safety switch)** | **Remove**: deploy with plain `npx wrangler deploy` |
| `ADMS_HEARTBEAT_MS`, `ADMS_ROUTINE_RECORD_MS` | Not set (300 s defaults) | Same |
| `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_USER_ID` | Not set (Vercel answers 503 too) | Optional, a later improvement |
| Secrets | `FIREBASE_SERVICE_ACCOUNT` only | Same |
| Compatibility | `2026-09-01`, `nodejs_compat`, `global_fetch_strictly_public` | Same |
| Observability | Workers Logs on | Same |

## 4. Free-plan capacity (MEASURED earlier)
| Item | Value | Free limit |
|---|---|---|
| X2008 requests | about 25,735 a day | 100,000 Worker requests a day. Static assets don't count. |
| Other Worker requests (sitemap, admin API) | Low hundreds a day, mostly cached | — |
| CPU per device request | 1–3 ms. Large user lists are split into 100-user chunks. | 10 ms |
| Firestore (relay) | about 4,400 reads and 730 writes a day | Spark: 50,000 reads and 20,000 writes a day |

## 5. Zone settings required before Phase B (owner applies; not readable with this login)
| Setting | Required value | Why |
|---|---|---|
| SSL/TLS encryption mode | Any. The Worker is the origin for `www`, so this mode isn't used. | — |
| **Always Use HTTPS** | **Off** | It would redirect the X2008's `http://` requests (if it ever uses HTTP). ADMS devices don't follow redirects. |
| HTTP → HTTPS for browsers | A **Redirect Rule**: when scheme is `http` **and** the path doesn't start with `/iclock/`, 301 to `https://` (path and query kept) | Browsers keep today's behaviour; the device is never redirected |
| Apex | Redirect Rule `crunnchhfitness.com/*` → `https://www.crunnchhfitness.com/$1` (308), on a proxied placeholder `A 192.0.2.1` | Replaces Vercel's apex redirect |
| **Minimum TLS version** | **1.0 (default). Don't raise it.** | Don't narrow what the X2008 can use |
| TLS 1.3 | On | As today |
| **Bot Fight Mode** | **Off** | It challenges non-browser clients such as the X2008 |
| Security Level / Browser Integrity Check for `/iclock/*` | Configuration Rule: Security Level **Essentially Off**, BIC **Off** | Never challenge the device |
| Rate limiting (1 free rule) | `/iclock/*`: block over 200 requests per 10 s per IP | Abuse guard, far above the device's rate |
| Caching | Default. `/iclock` and `/api/adms` answer `no-store`. | — |
| HSTS | Leave **off** at Cloudflare | Vercel sends `max-age=63072000` today, so returning browsers already insist on HTTPS. Cloudflare serves HTTPS, so that's fine. Adding HSTS would make a rollback harder. |

## 6. Certificates: the open risk
- **`workers.dev` (MEASURED):** ECDSA only (Let's Encrypt `YE2`, ISRG Root X2, cross-signed by X1). Clients offering only RSA ciphers fail the handshake.
- **Free-plan Universal SSL (Cloudflare docs):** ECDSA only. RSA needs a paid plan.
- **Custom Domains (Cloudflare docs):** a Custom Domain gets an "Advanced Certificate" for its hostname, with no Advanced Certificate Manager subscription needed. **The key type isn't documented. UNKNOWN.**
- **Vercel today (MEASURED):** RSA (Let's Encrypt `R`-chain, ISRG Root X1).

**How to close it:**
1. Run the X2008 `workers.dev` test. If the device connects over HTTPS, it accepts ECDSA, and the risk is closed for both certificate types.
2. If it doesn't, the ₹0 option is the device on **plain HTTP** (HTTPS **off**, port 80). That requires the §5 rule that never redirects `/iclock`. The device-to-Cloudflare link is then unencrypted. Today's relay-to-old-server link is already plain HTTP.
3. Optional, after Phase A: attach the Custom Domain to an **unused test hostname** (for example `x2008-test.crunnchhfitness.com`), with no effect on `www`. Read its certificate: `openssl s_client -connect x2008-test.crunnchhfitness.com:443 -servername x2008-test.crunnchhfitness.com </dev/null | openssl x509 -noout -text | grep 'Public Key Algorithm'`. That shows exactly what `www` would get.

## 7. Custom-domain requirements (for Phase B; not done)
1. The zone status is **active**.
2. **Delete the `www` CNAME** to Vercel first. A Custom Domain can't be created on a name with a CNAME (Cloudflare docs). Keep the value for rollback: `965a8f4a9ef5707e.vercel-dns-017.com`.
3. Attach it in the dashboard (Worker → Settings → Domains & Routes → Add → Custom Domain `www.crunnchhfitness.com`), **or** in `wrangler.toml`: `routes = [{ pattern = "www.crunnchhfitness.com", custom_domain = true }]` plus `npx wrangler deploy`. **Not added to the file now.**
4. Wait for the certificate to show "Active" (minutes).
5. The apex redirect and the §5 rules are in place.
6. No `routes` with wildcards are needed. `run_worker_first` already limits Worker invocations to `/iclock/*`, `/api/*`, `/sitemap.xml` and `/poc/*`.

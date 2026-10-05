# DNS cut-over audit: crunnchhfitness.com

**Status: audit only. Nothing was changed.** Taken on 5 October 2026, 10:30–10:40 UTC.

**Sources:**
- Public DNS through Google DNS-over-HTTPS, which answers from Namecheap's authoritative servers today.
- The `.com` registry (RDAP).
- The Cloudflare API, read-only (zone, Worker domains, routes).
- This repository.

**What this audit could not see:** the records inside the Cloudflare zone. The login used here (wrangler) has no DNS-read permission, so those rows are marked **NEEDS OWNER CONFIRMATION**. Also, public DNS can't list a zone completely: a record under a name nobody guessed wouldn't show up. Neither this audit nor `DNS_MIGRATION_CHECKLIST.md` replaces a **Namecheap zone export**.

## Labels
| Label | Meaning |
|---|---|
| **VERIFIED** | Measured today, by the method shown |
| **NEEDS OWNER CONFIRMATION** | Only visible in a dashboard (Namecheap, Cloudflare, Firebase, Google) or a decision is needed |
| **MUST PRESERVE** | Has to exist with the same meaning after the switch, or something breaks (usually email) |
| **UNKNOWN** | Couldn't be determined; treat it as a risk until it's answered |

One row can carry two labels, for example VERIFIED + MUST PRESERVE.

## 1. Domain and delegation
| Item | Current | Label |
|---|---|---|
| Registrar | Namecheap (registered 2026-03-30, expires 2029-03-30) | VERIFIED (RDAP) |
| Registry lock | `client transfer prohibited` (a normal transfer lock). It doesn't block a nameserver change. | VERIFIED (RDAP) |
| Nameservers in use | `dns1.registrar-servers.com`, `dns2.registrar-servers.com` | VERIFIED (RDAP, DoH) |
| SOA | `dns1.registrar-servers.com hostmaster.registrar-servers.com`, serial `1774894918` | VERIFIED |
| DNSSEC | **Off** (`delegationSigned: false`; no DS or DNSKEY). There's no DS record to remove before changing nameservers. | VERIFIED |
| Wildcard records | None (a random name returns NXDOMAIN for A and MX) | VERIFIED |

## 2. Cloudflare zone (prepared, not active)
| Item | Value | Label |
|---|---|---|
| Zone | `crunnchhfitness.com`, **Full** setup, **Free** plan, id `9619517320720d379411783c87762bb7` | VERIFIED (API) |
| Status | **pending**: the nameservers haven't moved, so Cloudflare serves nothing for this domain | VERIFIED (API) |
| Assigned nameservers | `armfazh.ns.cloudflare.com`, `journey.ns.cloudflare.com` | VERIFIED (API) |
| Created | 2026-10-05 08:58 UTC | VERIFIED (API) |
| Worker custom domains (account) | **None** | VERIFIED (API) |
| Worker routes on the zone | **None** | VERIFIED (API) |
| Rulesets (redirects, WAF, configuration rules) | None | VERIFIED (API) |
| Email Routing | Not enabled (`status: unconfigured`). Reading this setting showed a `created` time equal to the moment it was read: Cloudflare sets up an empty, disabled settings entry on first read. Nothing was turned on, and no DNS records were added. | VERIFIED (API) |
| **The zone's DNS records** (imported when the zone was created) | The import reported A `@` `216.198.79.1`, CNAME `www` → `965a8f4a9ef5707e.vercel-dns-017.com`, five MX `eforward1–5`, one SPF TXT. **Not re-checked today.** | **NEEDS OWNER CONFIRMATION**: Cloudflare → DNS → Records → **Export**, then compare with section 3 |
| Proxy status (orange or grey cloud) of the imported records | Not visible | **NEEDS OWNER CONFIRMATION**: all must be **DNS only (grey)** for Phase A (section 6) |
| SSL/TLS, Always Use HTTPS, minimum TLS, Bot Fight Mode, Security Level | Not readable with this login | **NEEDS OWNER CONFIRMATION**: see `PRODUCTION_DOMAIN_READINESS.md` §5 for the required values |

## 3. Records today (Namecheap, authoritative)
| # | Name | Type | Value | TTL | Purpose | Label |
|---|---|---|---|---|---|---|
| 1 | `@` | A | `216.198.79.1` | 1800 | Vercel apex: 308 redirect to `https://www.…` | VERIFIED. **MUST PRESERVE** (for rollback; replaced in Phase B) |
| 2 | `www` | CNAME | `965a8f4a9ef5707e.vercel-dns-017.com` | 1800 | Vercel: website, admin, **X2008 relay** (`/iclock`) | VERIFIED. **MUST PRESERVE** (for rollback; replaced in Phase B) |
| 3 | `@` | MX 10 | `eforward1.registrar-servers.com` | 1800 | Namecheap email forwarding | VERIFIED. **MUST PRESERVE** |
| 4 | `@` | MX 10 | `eforward2.registrar-servers.com` | 1800 | Namecheap email forwarding | VERIFIED. **MUST PRESERVE** |
| 5 | `@` | MX 10 | `eforward3.registrar-servers.com` | 1800 | Namecheap email forwarding | VERIFIED. **MUST PRESERVE** |
| 6 | `@` | MX 15 | `eforward4.registrar-servers.com` | 1800 | Namecheap email forwarding | VERIFIED. **MUST PRESERVE** |
| 7 | `@` | MX 20 | `eforward5.registrar-servers.com` | 1800 | Namecheap email forwarding | VERIFIED. **MUST PRESERVE** |
| 8 | `@` | TXT | `v=spf1 include:spf.efwd.registrar-servers.com ~all` | 1800 | SPF for forwarding | VERIFIED. **MUST PRESERVE** |

The `www` A, AAAA and HTTPS answers are Vercel's own records behind the CNAME (`64.29.17.65`, `216.198.79.65`). They aren't records in this zone.

## 4. Records looked for and not found
| Looked for | Result | Label |
|---|---|---|
| AAAA `@` | none | VERIFIED |
| CAA `@` | none. Any CA may issue, Cloudflare's included. If CAA is ever added, it must allow Cloudflare's CAs (Let's Encrypt, Google Trust Services, SSL.com). | VERIFIED |
| HTTPS/SVCB `@` | none | VERIFIED |
| DMARC (`_dmarc`) | none | VERIFIED. Don't add one during the switch. |
| DKIM (`google._domainkey`, `default._domainkey`, plus 25 more selectors in the earlier inventory) | none | VERIFIED for the names tried |
| `_vercel` TXT (Vercel domain verification) | none | VERIFIED |
| `_acme-challenge` / `_acme-challenge.www` | none | VERIFIED |
| `mail`, `webmail`, `api`, `admin`, `blog` (plus 27 more in the earlier inventory) | none | VERIFIED for the names tried |
| `google-site-verification` or other TXT at `@` | none (the only TXT is SPF) | VERIFIED. Search Console may be verified another way: **UNKNOWN**, see §5 |

## 5. Firebase, Vercel and Google dependencies (not DNS, but affected by the domain)
| Item | Finding | Label |
|---|---|---|
| Firebase Hosting | Not used. No DNS records point at Firebase. | VERIFIED (DNS, repository) |
| Firebase Auth domain | `crunch-fitness-blog.firebaseapp.com` (in `src/lib/firebase.ts`). Not on this domain, so it's unaffected. | VERIFIED |
| Sign-in methods | Email and password only (`signInWithEmailAndPassword` on the admin, trainer, client and marketing logins). There's no popup, redirect or phone/reCAPTCHA flow, so the Firebase "authorized domains" list isn't involved. The site also keeps the same hostname. | VERIFIED (repository) |
| Firebase email templates (password reset): action URL | Default is `…firebaseapp.com/__/auth/action`. If it was customised to `www.crunnchhfitness.com/…`, the Worker serves the SPA there exactly as Vercel does. | **NEEDS OWNER CONFIRMATION** (Firebase → Authentication → Templates) |
| Google API key referrer restrictions (Firebase web key, Maps key) | Any restriction is by referrer hostname. The hostname doesn't change, so nothing changes. **`workers.dev` itself may be refused** if keys are restricted (only matters for browser tests on `workers.dev`). | **NEEDS OWNER CONFIRMATION** (Google Cloud → Credentials) |
| Firebase Storage CORS | Same origin before and after. No change. | VERIFIED (same hostname) |
| Vercel domain assignment | `www` and the apex are assigned to the Vercel project. **Keep them assigned** until 7 stable days on Cloudflare (rollback). | **MUST PRESERVE** |
| Vercel A/CNAME targets | `216.198.79.1` and `965a8f4a9ef5707e.vercel-dns-017.com`. These are the rollback values. | VERIFIED. **MUST PRESERVE** (written into the rollback steps) |
| Google Search Console / Analytics (`G-9PQSYTR6G7`) | Analytics is a script on the page, so it's unaffected. How Search Console is verified isn't known. | **UNKNOWN** (owner: Search Console → Settings → Ownership verification) |
| Namecheap email forwarding rules (address → inbox) | Only visible in Namecheap | **NEEDS OWNER CONFIRMATION**. **MUST PRESERVE** (recreate one for one if forwarding moves to Cloudflare Email Routing) |

## 6. Required final DNS (two phases, recommended)
Changing the nameservers and moving the website are **separate steps**. Each has its own rollback.

**Phase A: move the nameservers only; nothing changes for visitors.** Every record in the Cloudflare zone mirrors Namecheap's, set to **DNS only**. After activation, the site and the X2008 still go to Vercel; only the DNS host has changed.

**Phase B (later, separately approved): move the website.** Attach the Worker Custom Domain to `www` and turn the apex into a redirect.

| Name | Type | Today (Namecheap) | Phase A (Cloudflare, after NS move) | Phase B (final) | Label |
|---|---|---|---|---|---|
| `@` | A | `216.198.79.1` | `216.198.79.1`, **DNS only** | Placeholder `A 192.0.2.1`, **proxied**, plus a Redirect Rule: `@` → `https://www.crunnchhfitness.com` (308, path and query kept) | VERIFIED today; Phase A values NEED OWNER CONFIRMATION in the zone |
| `www` | CNAME | `965a8f4a9ef5707e.vercel-dns-017.com` | Same, **DNS only** | **Delete the CNAME, then** attach the Worker Custom Domain `www.crunnchhfitness.com` → `crunch-site`. A Custom Domain can't be created while a CNAME exists on the name (Cloudflare docs). Cloudflare then creates its own record. | VERIFIED today; Phase B step order from Cloudflare docs |
| `@` | MX ×5 | `eforward1–5` (10/10/10/15/20) | Same, **unchanged**, or Cloudflare Email Routing (`route1–3.mx.cloudflare.net`). **Decision needed.** | Same as Phase A | **MUST PRESERVE**. NEEDS OWNER CONFIRMATION (decision) |
| `@` | TXT SPF | `v=spf1 include:spf.efwd.registrar-servers.com ~all` | Matches the MX choice | Same as Phase A | **MUST PRESERVE** |
| any other record in the Namecheap export | — | Identical | Identical | **MUST PRESERVE**. NEEDS OWNER CONFIRMATION (export) |
| NS | — | Namecheap BasicDNS | `armfazh` / `journey.ns.cloudflare.com` (set at Namecheap) | Same | VERIFIED (assigned names) |

## 7. Missing or suspicious
| # | Finding | Risk | Label |
|---|---|---|---|
| 1 | **No Namecheap zone export on file.** Public DNS can't prove there are no other records. | A forgotten record (verification, a subdomain) disappears on the NS move | NEEDS OWNER CONFIRMATION |
| 2 | **The Cloudflare zone's records can't be read with the current login.** | The NS move would publish whatever the import created, including the proxy status | NEEDS OWNER CONFIRMATION |
| 3 | **Email forwarding is a Namecheap DNS feature.** Namecheap documents it for its own DNS only. | Mail to `@crunnchhfitness.com` might stop after the NS move if the `eforward` MX records are kept but Namecheap stops forwarding | NEEDS OWNER CONFIRMATION (decision: Cloudflare Email Routing, or Namecheap's written OK) |
| 4 | **Free-plan Cloudflare certificates are ECDSA-only** (Universal SSL, and `workers.dev`, MEASURED). Vercel's certificate today is RSA. | If the X2008 can't do ECDSA, it can't reach the Worker over HTTPS, on `workers.dev` or the domain | **UNKNOWN**: answered by the `workers.dev` test (`X2008_FINAL_TEST_RUNBOOK.md`) |
| 5 | A Custom Domain gets its own "Advanced Certificate" (Cloudflare docs). Its key type on the Free plan isn't documented. | The certificate on `www` could differ from `workers.dev` | **UNKNOWN**: measure after Phase A on a test hostname (`PRODUCTION_DOMAIN_READINESS.md` §6) |
| 6 | Search Console verification method not known | Ownership could be lost if it relies on a record not seen | **UNKNOWN** |
| 7 | The record TTLs are 1800 s | Slower rollback | Lower `@` and `www` to 300 s at Namecheap **48 h before** Phase A |
| 8 | Nothing else looks suspicious: no stray A records, no wildcard, no DNSSEC, no CAA | — | VERIFIED |

## 8. Before Phase A, the owner must
1. Export the Namecheap zone (Domain List → Manage → Advanced DNS) and keep the file.
2. Export the Cloudflare zone (DNS → Records → Export). It must match the Namecheap export record for record, with every record **DNS only**.
3. List the Namecheap email-forwarding rules, and decide: Cloudflare Email Routing, or keep `eforward` with Namecheap's written OK.
4. Check the Firebase email-template action URL and the API-key referrer restrictions (§5).
5. Find out how Search Console is verified (§5).
6. Lower the TTLs for `@` and `www` to 300 s, 48 h ahead.

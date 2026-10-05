# DNS migration checklist: crunnchhfitness.com → Cloudflare

**Status: inventory and plan only. Nothing has been changed.**

The inventory was taken on 5 October 2026 from public DNS (Google DNS-over-HTTPS). It covers every
standard record type at the apex and `www`, `_dmarc`, 27 common DKIM selectors and 32 common
subdomains.

> **Public DNS can't list a zone completely.** A record under an unguessed name, or a DKIM selector
> not on the list, wouldn't show up. **Before any change, export the zone from Namecheap** (Domain
> List → Manage → Advanced DNS) and compare it line by line with the table below. That's the
> authoritative list.

## 1. Current DNS (MEASURED)

**Registrar and DNS host:** Namecheap (BasicDNS, `dns1/dns2.registrar-servers.com`). SOA serial
`1774894918`.

| # | Name | Type | Value | Priority | TTL | Purpose |
|---|---|---|---|---|---|---|
| 1 | `crunnchhfitness.com` | NS | `dns1.registrar-servers.com` | — | 1800 | Namecheap DNS |
| 2 | `crunnchhfitness.com` | NS | `dns2.registrar-servers.com` | — | 1800 | Namecheap DNS |
| 3 | `crunnchhfitness.com` | A | `216.198.79.1` | — | 1800 | Vercel (redirects to `https://www.…`, 308) |
| 4 | `www.crunnchhfitness.com` | CNAME | `965a8f4a9ef5707e.vercel-dns-017.com` | — | 1800 | Vercel: website, admin, **X2008 relay** |
| 5 | `crunnchhfitness.com` | MX | `eforward1.registrar-servers.com` | 10 | 1800 | **Email forwarding** |
| 6 | `crunnchhfitness.com` | MX | `eforward2.registrar-servers.com` | 10 | 1800 | **Email forwarding** |
| 7 | `crunnchhfitness.com` | MX | `eforward3.registrar-servers.com` | 10 | 1800 | **Email forwarding** |
| 8 | `crunnchhfitness.com` | MX | `eforward4.registrar-servers.com` | 15 | 1800 | **Email forwarding** |
| 9 | `crunnchhfitness.com` | MX | `eforward5.registrar-servers.com` | 20 | 1800 | **Email forwarding** |
| 10 | `crunnchhfitness.com` | TXT | `v=spf1 include:spf.efwd.registrar-servers.com ~all` | — | 1800 | **SPF** for forwarding |

**Not found (checked):**
- AAAA, CAA and HTTPS records;
- DMARC (`_dmarc`);
- DKIM (27 selectors);
- verification records (`_vercel`, `_acme-challenge`, Google, GitHub);
- 32 common subdomains (`mail`, `webmail`, `api`, `admin`, `blog`, …).

**Today's behaviour (MEASURED):**
- The apex and every `http://` request redirect **308 to `https://www.crunnchhfitness.com`**.
- `www` uses a Let's Encrypt certificate, TLS 1.3.
- So the X2008 must already call `https://www.crunnchhfitness.com/iclock/…` directly, over TLS ≥ 1.2.

**Related finding, fixed in source:** the site's canonical links, sitemap, `robots.txt` and social
images pointed at `www.crunchfitness.fitness`, a domain that **doesn't exist** (NXDOMAIN). They now
use `www.crunnchhfitness.com` (uncommitted). There's nothing to migrate for `crunchfitness.fitness`.

## 2. Target DNS (on Cloudflare, free plan)

| # | Name | Type | Target value | Proxy | TTL | Change? |
|---|---|---|---|---|---|---|
| 3 | `crunnchhfitness.com` | — | **Redirect rule** apex → `https://www.crunnchhfitness.com` (308, path and query kept), needing a proxied placeholder record (`A 192.0.2.1`, proxied) | Proxied | Auto | **Changed**: replaces Vercel's redirect |
| 4 | `www.crunnchhfitness.com` | Worker **Custom Domain** (`crunch-site` Worker: static site + `/iclock/*` + `/api/*` + `/sitemap.xml`) | — | Proxied (automatic) | Auto | **Changed**: Vercel → Worker |
| 5–9 | `crunnchhfitness.com` | MX | **Option A (recommended):** Cloudflare Email Routing MX (created by Cloudflare). **Option B:** exactly rows 5–9, only with Namecheap's written OK | DNS only | Auto / 1800 | **Decision needed** (see below) |
| 10 | `crunnchhfitness.com` | TXT (SPF) | **Option A:** `v=spf1 include:_spf.mx.cloudflare.net ~all`. **Option B:** exactly row 10 | DNS only | Auto / 1800 | **Follows the MX decision** |
| — | Anything else in the Namecheap export | as exported | as exported | DNS only unless it's a web host | as exported | **Must stay unchanged** |
| 1–2 | NS | — | Cloudflare's two assigned nameservers | — | — | **Changed at Namecheap** (the cut-over step) |

**Email forwarding: decision needed before the switch.**
- Namecheap's docs say its free forwarding "is available for all the domains pointed to our
  BasicDNS, PremiumDNS, or FreeDNS systems". **Cloudflare nameservers aren't on that list.** Keeping
  the `eforward*` MX records after the move might keep working, but it would be unsupported.
- **Recommended (₹0, supported): move forwarding to Cloudflare Email Routing (free plan) in the same
  window.**
  - It replaces rows 5–10 with Cloudflare's MX records (`route1/2/3.mx.cloudflare.net`) and its SPF
    (`v=spf1 include:_spf.mx.cloudflare.net ~all`). Cloudflare creates these when Email Routing is
    enabled.
  - Recreate every forwarding rule (address → destination inbox) from the Namecheap dashboard
    (Domain → Redirect Email). Each destination inbox must click Cloudflare's verification email.
  - **NEEDS YOUR ACTION:** list the current forwarding rules (only visible in Namecheap).
- **Not recommended: keep rows 5–10 as they are.** Only acceptable if Namecheap support confirms in
  writing that forwarding keeps working with third-party nameservers.
- **Why the nameservers must move at all:** a Worker on `www.crunnchhfitness.com` needs the zone on
  Cloudflare. The alternative CNAME (partial) setup needs the paid Business plan, which isn't ₹0.

## 3. Cloudflare zone configuration (prepare; don't activate)

| Setting | Value | Why |
|---|---|---|
| Plan | **Free** | ₹0 |
| SSL/TLS mode | Not relevant to `www` (the Worker is the origin) | — |
| Edge certificates | Universal SSL (apex + `www`), automatic | Free |
| **Minimum TLS version** | **1.0 (default). Don't raise it** | The X2008's TLS client is unknown; it's proven ≥ 1.2 but don't narrow anything at cut-over |
| TLS 1.3 | On | As today |
| **Always Use HTTPS** | **Off.** Instead, a Redirect Rule: `http://*` → `https://` **except** path `/iclock/*` | Browsers redirected as today. A device request is never redirected (ADMS clients don't follow redirects). |
| **Bot Fight Mode** | **Off** | It challenges non-browser clients such as the X2008 |
| Security level / Browser Integrity Check | Configuration Rule for path `/iclock/*`: Security Level **Essentially Off**, BIC **Off** | Never challenge the device |
| WAF rate limiting (free: 1 rule) | `/iclock/*`: block over 200 requests per 10 s per IP | Abuse guard about 700× above the device's real rate |
| Caching | Default. Static assets are served by the Worker's assets; `/iclock` and `/api` are never cached (`no-store`) | — |
| Worker routes | Custom domain `www.crunnchhfitness.com` → `crunch-site`. `run_worker_first`: `/iclock/*`, `/api/*`, `/sitemap.xml` | Only these count as Worker requests |
| Observability | Workers Logs on (free tier) | Monitoring at cut-over |

## 4. Record-by-record mapping

| Current (Namecheap) | → Target (Cloudflare) | Verify after the switch |
|---|---|---|
| NS `registrar-servers.com` ×2 | NS Cloudflare ×2 (set at Namecheap) | `dig NS crunnchhfitness.com` shows Cloudflare |
| A apex `216.198.79.1` | Redirect rule (proxied placeholder) | `curl -I https://crunnchhfitness.com` → 308 to `https://www.…` |
| CNAME `www` → Vercel | Worker Custom Domain | Site loads; `/iclock` hits the Worker (Workers Logs); `/api/adms?check=health` → `{"alive":true…}` |
| MX ×5 (Namecheap forwarding) | **A:** Cloudflare Email Routing MX (recommended) / **B:** identical | `dig MX`; **a test email to every forwarded address arrives** |
| TXT SPF | Matches the MX option | `dig TXT` shows the matching SPF string |
| (any other exported record) | **Identical** | Compare with the export |

## 5. Email records (special attention)

- **MX (5) and SPF (1): today's forwarding depends on them, and it's a Namecheap DNS feature.**
  Choose Option A (Cloudflare Email Routing, recommended) or B (unchanged, only with Namecheap's
  written confirmation) **before** the switch. Either way, test every forwarded address after it.
  **In the rollback, the original MX and SPF come back with the Namecheap nameservers.**
- **DKIM / DMARC:** none exist today. **Don't add them during the migration.** Adding DMARC
  afterwards (for example `v=DMARC1; p=none; rua=…`) is a separate, later improvement.
- **Test before and after:** send mail from an outside account to each forwarded address; confirm it
  arrives at the destination inbox.

## 6. Rollback records

Keep **this document's section 1** and the **Namecheap export** as the rollback source.

| Step | Action | Takes effect |
|---|---|---|
| Fast rollback (the nameservers have already moved to Cloudflare) | In Cloudflare DNS: `www` → **CNAME `965a8f4a9ef5707e.vercel-dns-017.com`, DNS only**. Remove the Worker Custom Domain from `www`. Apex → **A `216.198.79.1`, DNS only**. MX and TXT untouched. | Within the record TTL (set 300 s ahead of the switch) |
| Full rollback | At Namecheap: nameservers back to **Namecheap BasicDNS**. The Namecheap zone is unchanged throughout, so all records are still there. | Up to 24–48 h (resolver caches). Keep Vercel live all the while. |

**Before the switch:**
1. Lower the Namecheap TTLs for `@` and `www` to 300 s, **48 h in advance**.
2. Leave the Namecheap zone **intact** (it's the rollback).
3. Keep the Vercel project and its domain assignment untouched until 7 stable days on Cloudflare.

## 7. Records that must remain unchanged

- The **Namecheap zone, including MX ×5 and SPF**: kept intact as the rollback copy (whichever
  email option is chosen on Cloudflare)
- **Email forwarding rules** (address → inbox): recreated one for one if Option A is chosen
- Every record in the Namecheap export that isn't `@` or `www` web hosting
- The Namecheap zone itself (left as the rollback copy)
- The Vercel project and deployment

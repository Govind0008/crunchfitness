# X2008 test on workers.dev, stage 1: connectivity and polling only

**Status: prepared, not run. Needs explicit approval on the day.**

**What it proves:** the real X2008 can talk to the Cloudflare Worker, and the Worker relays it to the old server. It also settles whether the device accepts Cloudflare's **ECDSA** certificate. It takes about 20 minutes; the device is on Cloudflare for about 10 of them.

**What it doesn't touch:** DNS, Namecheap, Vercel, the website, and every X2008 setting except the server address.

**What it writes:** exactly what Vercel writes for the device today: diagnostics, the device's last contact, and any punches the device uploads. **No CRM command can reach the device.** The live Worker has `ADMS_DELIVER_CRM_COMMANDS=0`, and the harness checks that before you start.

## Not in stage 1
- **No punch.** Nobody scans a finger during the window. A punch the device had stored is uploaded and recorded normally; the harness flags it for review.
- **No Open Door**, **no enrolment** and **no user sync** from the CRM. Even if someone presses them, the commands stay queued. Vercel would deliver them after the switch-back, and an Open Door expires after 30 s.
- **No other X2008 setting changed.**

## People and equipment
- One person **at the X2008**, with a phone camera.
- One person **at a laptop** with this repository, logged in to wrangler (`npx wrangler whoami`), with the key at `~/.secrets/crunch-adms-worker.json`.
- The owner reachable.
- **When:** a quiet time, ideally gym closed.

## Commands (from the repository's `cloudflare/` folder)
| When | Command | What it does |
|---|---|---|
| Before | `npm run x2008 -- preflight` | Read-only. Guards on; Worker version `95c25fe6…` at 100%; `ADMS_DELIVER_CRM_COMMANDS="0"`; only secret `FIREBASE_SERVICE_ACCOUNT`; no custom domains or routes; one CRM device for `JJA1254700696`; **queued = 0**; device polling; baseline saved to `~/.crunch-x2008/<time>/` |
| During | `npm run x2008 -- monitor` | Read-only. Live Worker log for the device plus a Firestore read every 60 s. **Enter** = address saved on the X2008; **r** + Enter = address restored (it finishes 60 s later); **q** + Enter = finish now. Prints PASS/FAIL. |
| After | `npm run x2008 -- postcheck` | Read-only. For up to 7 min: the Worker goes quiet, and Firestore keeps being updated without it (by Vercel); queued and sent commands unchanged. Prints PASS/FAIL. |

**The harness never writes and never calls the device.** Every network request is checked before it's sent: Firestore reads only, Google's sign-in endpoint, and Cloudflare API reads only. Any `/iclock` URL, Firestore commit, transaction or write is refused. The preflight proves this first, with 10 guard checks that must all PASS. Raw logs stay in `~/.crunch-x2008/`, outside the repository.

Optional second screens:
- the old CRM's Monitor page `http://122.160.158.120:5072/` (view only);
- the CRM at `https://www.crunnchhfitness.com/admin/settings/access` and `/admin/access`;
- Cloudflare → Workers & Pages → `crunch-site` → Metrics;
- Vercel → Logs, filtered `/api/iclock`.

## The procedure
| # | Who | Step | Pass | If not |
|---|---|---|---|---|
| 1 | Laptop | `npm run x2008 -- preflight` | `RESULT: PASS`. **`Queued CRM commands = 0`.** | **STOP.** Don't touch the X2008. Clear any queued command in the CRM, then run it again. |
| 2 | Laptop | Confirm `Queued CRM commands = 0` in the output. It's the condition for going on. | 0 | STOP |
| 3 | X2008 | **Photograph** Menu → COMM. → **Cloud Server Setting**: Server Mode, Enable Domain Name, **Server Address**, **Server Port**, **HTTPS**, Enable Proxy Server (+ proxy IP/port), every other item on the screen. Also COMM. → **Ethernet** (IP, mask, gateway, **DNS**, DHCP), System → **Date/Time**, and System Info → **Device Info** (serial, firmware). | Expected: ADMS; domain name ON; `www.crunnchhfitness.com`; 443; HTTPS ON; proxy OFF; serial `JJA1254700696`; firmware `8.0.4.3-20240116`; correct clock | Anything else: **STOP** and report what the photos show |
| 4 | Laptop | `npm run x2008 -- monitor` (leave it running) | `[firestore] … queued 0 sent 0` printed | STOP |
| 5 | X2008 | Change **only** the Server Address: `www.crunnchhfitness.com` → **`crunch-site.gsalunke169.workers.dev`** | The field holds all 35 characters | Field too short: put the photographed value back and STOP |
| 6 | X2008 | **Keep HTTPS ON. Keep port 443. Change nothing else.** Save. | — | — |
| 7 | Laptop | Press **Enter** the moment it's saved | `marked: address CHANGED` | — |
| 8 | Laptop | **First handshake**, within about 60 s | A `handshake  http 200  old server 200` line, then `^ first handshake through the Worker` | No device line after **3 min**: the harness shows a red banner. **Restore (step 11).** Most likely the ECDSA certificate is refused (TLS), DNS, or a typo. |
| 9 | Laptop | **About 10 minutes of polling** | `command poll  http 200  old server 200  cpu 1ms` about every 3–4 s. The Firestore line every 60 s shows `queued 0 sent 0`, and `lastError null`. | Any line marked `<<< PROBLEM`, or a red banner: **restore now (step 11)** |
| 10 | Both | During the window: **no** finger scans, **no** Open Door, **no** enrolment, **no** Sync users | — | If it happens anyway, note the time (the commands stay queued; see above) |
| 11 | X2008 | **Restore** the Server Address to the photographed value (`www.crunnchhfitness.com`). Port and HTTPS unchanged. Save. | Matches the photo | — |
| 12 | Laptop | Type **r** + Enter. The monitor finishes 60 s later and prints its verdict. | `RESULT: PASS` (see criteria) | Note the FAIL lines; the restore stands anyway |
| 13 | Laptop | `npm run x2008 -- postcheck` | `RESULT: PASS`: Worker quiet, **Firestore updated by Vercel**, queued and sent unchanged | **Vercel not receiving:** check the X2008 address against the photo (step 11 again). Check Vercel → Logs → `/api/iclock`. |
| 14 | Laptop | Optional, read-only: Vercel → Logs → `/api/iclock` shows the device again. The old CRM's Monitor shows it live. | Yes | As step 13 |

**Optional fallback (only with approval on the spot, and only if step 8 failed with no device request at all):** set HTTPS **OFF** and port **80**, address `crunch-site.gsalunke169.workers.dev`, and repeat steps 7–9. Plain HTTP works on `workers.dev` (MEASURED: no redirect). Afterwards, restore **all three** values from the photo. A pass here means the device can't do ECDSA, and the production plan must use HTTP for the device (`PRODUCTION_DOMAIN_READINESS.md` §6).

## Success criteria (stage 1 passes only if all hold)
| # | Criterion | Shown by |
|---|---|---|
| 1 | The handshake reached the Worker **over HTTPS on port 443, with the settings unchanged** | monitor: `PASS First handshake through the Worker` |
| 2 | Steady polling: **at least 100 polls**, median interval **10 s or less** (expected about 3.6 s) | monitor: `Steady polling`, `Poll interval` |
| 3 | Every answer 2xx; no exceptions; no failed outcomes; no CPU-limit errors | monitor: `No 4xx/5xx, exceptions or failed outcomes` |
| 4 | The old server answered **200** to every relayed request, and the old CRM shows the device live | monitor: `Old server answered 200`, plus its Monitor page |
| 5 | **Queued and sent CRM commands unchanged** throughout and afterwards | monitor: `CRM command queue unchanged`; postcheck: `Queued/Sent … unchanged` |
| 6 | No new old-server command types compared with the baseline (if there are, review them; that's the old server's own behaviour) | monitor: `Old-server commands as in the baseline` |
| 7 | No secret-like text in the Worker log | monitor |
| 8 | Device `lastError` empty at the end | monitor, postcheck |
| 9 | **After the restore: the Worker is quiet and Vercel is recording the device again** | postcheck: `Worker quiet`, `Firestore updated by Vercel after restore` |
| 10 | No door movement at any time | The person at the X2008 |

A **REVIEW** line isn't a failure, but it must be read. Examples: a stored punch uploaded, fewer than 100 polls because the window was short, another serial calling `/iclock`.

## Stop conditions: restore the address (step 11) at once
- No device request at the Worker **3 minutes** after saving (red banner).
- Any line marked `<<< PROBLEM`: a 4xx/5xx, `old server` not 200, a NOTE such as "old server unreachable", an exception, or a failed outcome.
- A red banner "command queue changed", or anything moving in `queued` or `sent`.
- The device stops calling the Worker for over 60 s (red banner).
- The old CRM shows the device offline for over 2 minutes while the monitor shows polling.
- **Any door movement**, or anything unexpected at the device.
- Anyone needs the device for real use (a member at the door).

## Restore (always, pass or fail)
1. On the X2008: Server Address back to the **photographed** value; port and HTTPS as photographed. Save.
2. `npm run x2008 -- postcheck` → `PASS`.
3. If it fails: compare every Cloud Server field with the photos, and check Vercel → Logs → `/api/iclock`.
   - Vercel was never changed, so once the address is back, the device is back.
   - The device keeps stored punches until a server acknowledges them, so nothing is lost while it retries.
4. **Leave** `ADMS_DELIVER_CRM_COMMANDS=0` on the Worker. It's removed only as part of the production cut-over (`FINAL_CUTOVER_RUNBOOK.md`).

## After the test, report
- The monitor and postcheck verdicts. The summaries are in `~/.crunch-x2008/<time>/monitor-summary.json` and `postcheck-summary.json`.
- **HTTPS worked: yes or no.** This answers the ECDSA question.
- The photos from step 3.
- Anything flagged REVIEW.

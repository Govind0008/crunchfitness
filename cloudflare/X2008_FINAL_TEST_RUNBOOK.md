# X2008 physical test on the production architecture

**Status: prepared, not run. Each stage needs explicit approval on the day.**

## The architecture under test (production since 5 October 2026)
```
X2008 (JJA1254700696)
  → https://www.crunnchhfitness.com/iclock/…     (unchanged device setting)
  → Cloudflare Worker crunch-site                  (Custom Domain on the active zone)
  → old ADMS server http://122.160.158.120:5072    (every request relayed; its answers go back to the device)
```

**This test never changes the X2008's server address.**
- The device is **not** pointed at `workers.dev`, and **not** switched to Vercel.
- It keeps calling `www.crunnchhfitness.com`; DNS decides which platform answers.

**What the Worker runs with during testing** (live version `f4cfcfc0-07a9-49f5-83be-bbee4870f4f6`):
- `ADMS_DELIVER_CRM_COMMANDS=0`, the safety switch. **No CRM-generated command** (Open door, add user, enrolment, user-list requests) reaches the device. Queued commands stay queued.
  - While it's on, **CRM Open Door, enrolment and Sync users don't work** for the real device, on purpose.
- The old server's own commands **still pass through**, including `DATA DELETE USERINFO`. See `OLD_SERVER_DELETE_USERINFO_FINDINGS.md`.

## Where the device is today (MEASURED 5 Oct, 13:22 UTC)
- **The device isn't on the Worker yet.** A 4-minute monitor saw no device request at the Worker, though the tail itself was working (it captured test health requests). Firestore kept recording the device (13:21:31 UTC, 200/200), so another relay, Vercel, is still serving it.
- **The cause is DNS caching.** The registry moved the nameservers to Cloudflare at 12:37 UTC. Public resolvers (Google, Cloudflare) already answer `www` → Cloudflare. But resolvers that cached the old `.com` delegation (up to **48 h**, so until about **7 Oct 12:37 UTC**) still ask Namecheap, which answers `www` → Vercel. The resolver used for this check (a Pune ISP connection) still answered Vercel at 13:23 UTC; the gym's resolver is likely the same. The X2008 may also cache DNS itself until it restarts.
- **CRM Open Door is in live use, and while the device is on Vercel nothing blocks it.** At 13:27 UTC (18:57 IST) on 5 Oct, an `unlock_door` was queued in the CRM (13:27:09), sent through **Vercel** (13:27:14) and carried out by the device (`Return=0`, 13:27:17). The safety switch exists only on the Cloudflare Worker.
- **So the device moves to the Worker on its own**, at a time nobody controls, by 7 Oct about 12:37 UTC at the latest (later only if the device caches DNS until a restart). From that moment the safety switch applies to it.

## Commands (from `cloudflare/`; all read-only)
| Command | Use |
|---|---|
| `npm run x2008 -- preflight` | Must be `RESULT: PASS`. It checks: guards; version `f4cfcfc0…` at 100%; `ADMS_DELIVER_CRM_COMMANDS="0"`; `ADMS_UPSTREAM` = old server; one secret; **exactly one custom domain `www.crunnchhfitness.com`**; zone active; no zone routes; one CRM device; **queued = 0**; no unanswered commands; device polling; `lastError` empty. It saves the baseline. |
| `npm run x2008 -- monitor` | Live Worker log for the device, plus a Firestore read every 60 s. Enter = mark a step; r + Enter = mark the end (finishes 60 s later); q + Enter = finish now. Options: `--minutes N`, `--min-polls N`. |
| `postcheck` | **Not used in this test.** It's only for after a rollback, to confirm the device has left the Worker. |

**How to read the monitor here:** the device doesn't re-handshake when DNS moves it; it simply keeps polling. So **`FAIL First handshake through the Worker` alone isn't a failure in this test**, unless the device was restarted. Steady polling, 200/200 answers, and the queue unchanged are what count. This is a known gap in the monitor's stage-1 wording; see "What remains".

## Stage 0: is the device on the Worker? (read-only, any time, no one at the device)
1. `npm run x2008 -- preflight` → `RESULT: PASS`.
2. `npm run x2008 -- monitor --minutes 5 --min-polls 50`.
   - **On the Worker:** `command poll  http 200  old server 200` lines about every 3–4 s, and the Firestore line showing `queued 0 sent 0`, `lastError null`.
   - **Not on the Worker yet:** no device lines, while the Firestore line's `lastSeenAt` still moves (Vercel). Repeat later. **Don't** change the device to force it.
3. Optional, read-only: public DNS for `www` (`curl -s "https://dns.google/resolve?name=www.crunnchhfitness.com&type=A"`) should show Cloudflare addresses (`104.21.x.x` / `172.67.x.x`).

**If the device still isn't on the Worker after 7 Oct 13:00 UTC:** it's probably caching DNS itself. The only remedies are **restarting the X2008** or changing its DNS server. Each is a separate decision for the owner; neither is part of this runbook.

## Stage 1: connectivity and polling on the Worker (no punch)
**Pre-conditions (all):**
- Stage 0 shows the device on the Worker.
- `OLD_SERVER_DELETE_USERINFO_FINDINGS.md` §4 items 1–2 are answered, or the owner has accepted the risk in writing.
- A quiet time; one person able to see the X2008; the owner reachable.

| # | Step | Pass | If not |
|---|---|---|---|
| 1 | `npm run x2008 -- preflight` | `RESULT: PASS`. **`Queued CRM commands = 0`.** | **STOP.** Clear the queue in the CRM; run it again. |
| 2 | Photograph the X2008 screens **without changing anything**: COMM. → Cloud Server Setting (server mode, domain-name switch, **server address**, **port**, **HTTPS**, proxy); COMM. → Ethernet (IP, gateway, **DNS**); System → Date/Time; System Info (serial, firmware, **user and fingerprint counts**) | Address `www.crunnchhfitness.com`; port 443; HTTPS ON; proxy OFF; serial `JJA1254700696`; correct clock | Any difference: STOP and report the photos |
| 3 | `npm run x2008 -- monitor --minutes 10 --min-polls 100` | Runs; first Firestore line shows `queued 0 sent 0` | STOP |
| 4 | Watch about **10 minutes** | Polls every 3–4 s, each `http 200 old server 200`; no `<<< PROBLEM` line; no red banner | See stop conditions |
| 5 | Nobody scans a finger; nobody uses Open Door, enrolment or Sync users in the CRM | — | Note the time if it happens |
| 6 | When the monitor finishes, read the verdict | Criteria below | — |
| 7 | `npm run x2008 -- preflight` once more | `RESULT: PASS`; **queued and sent counts unchanged** from step 1 | Report |

**Success criteria (stage 1):**
| # | Criterion | Shown by |
|---|---|---|
| 1 | The device's polls arrive at the Worker steadily: **at least 100 in 10 min**, median interval 10 s or less | monitor: `Steady polling`, `Poll interval` |
| 2 | Every answer 2xx; no exceptions, failed outcomes or CPU-limit errors | monitor: `No 4xx/5xx…` |
| 3 | The old server answered 200 to every relayed request | monitor: `Old server answered 200…` |
| 4 | **Queued and sent CRM commands unchanged** throughout | monitor: `CRM command queue unchanged`; step 7 |
| 5 | **No `DATA DELETE USERINFO` (or any other old-server command) during the window.** Read the monitor's per-request lines (`old-server cmds:`), not just the verdict, because the baseline already contains `DATA DELETE USERINFO`. | monitor lines |
| 6 | `lastError` empty; Firestore diagnostics updating | monitor |
| 7 | No secret-like text in the log; no other serials | monitor |
| 8 | No door movement; the X2008 behaves normally | The person at the device |

**Expected and not a failure:** `FAIL First handshake through the Worker` (no restart), and the overall `RESULT: FAIL` that follows from it, **if** criteria 1–8 hold. Record it as "stage 1 passed except the handshake line".

## Stop conditions (stop watching, don't touch the device, report)
- Any `<<< PROBLEM` line: a 4xx/5xx, the old server not 200, a NOTE such as "old server unreachable", an exception.
- A red banner: "command queue changed", "stopped calling the Worker", "no device request".
- **Any `old-server cmds: DATA DELETE USERINFO`** (or any old-server command type) in the window.
- The old CRM's Monitor page shows the device offline for over 2 minutes.
- Any door movement, or anything unusual at the device.

**What "stop" means here:** the device's address is never changed in this test, so there's nothing to restore on the device. Whether to roll the website back to Vercel is a separate **DNS** decision for the owner (`FINAL_CUTOVER_RUNBOOK.md` §H), never a device change.

## Later stages (separate approvals, not part of stage 1)
- **Stage 2, one punch:** a CRM-linked staff member scans once. It should appear once in the old CRM and once in the CRM, with no duplicates. Then a legacy user scans: recorded as legacy or unknown, never denied.
- **Stage 3, CRM commands:** needs the safety switch **removed** (a deploy without `ADMS_DELIVER_CRM_COMMANDS`, approved separately). Then Sync users, then enrolment.
- **Stage 4, physical Open Door:** with the owner present (`REAL_DEVICE_CUTOVER_RUNBOOK.md` §D).

## What remains before stage 1
1. **The device must actually be on the Worker** (Stage 0). As of 13:22 UTC on 5 Oct it isn't.
2. **The `DATA DELETE USERINFO` question** answered by the old ADMS owner, or the risk accepted.
3. **An owner decision on Open Door during the DNS move.** Staff use CRM Open Door. When DNS moves the device to the Worker (any time until about 7 Oct 12:37 UTC), **CRM Open Door, enrolment and Sync users silently stop working**: commands stay queued and an Open Door expires after 30 s, for as long as `ADMS_DELIVER_CRM_COMMANDS=0` is on. Either tell staff now, or decide when the switch comes off (a separately approved deploy).
4. **No CRM Open Door during any test window**, by arrangement with staff. While the device is on Vercel, the switch doesn't protect the test at all.
5. **Proposed harness changes (not made):**
   - In the production architecture, don't require a handshake.
   - Always flag `DELETE` verbs, whatever the baseline.

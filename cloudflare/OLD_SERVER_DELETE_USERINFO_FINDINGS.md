# Old ADMS server: DATA DELETE USERINFO batches on 5 October 2026

**Status: observed, not explained.** Nothing was changed because of it, and the X2008 harness isn't modified yet. This note records what our relay saw, what it can't see, and what the old system's owner needs to provide.

## 1. What was observed (MEASURED, read-only)
Source: `admsDiagnostics/JJA1254700696` (the relay's contact record). It stores only the **command type and a count** for what the old server sends the device, never PINs, names or contents. Counts are totalled in memory between record writes, so they're exact for every write in the record.

| Record written (UTC) | IST | Request | Answer (relay / old server) | Old server → device |
|---|---|---|---|---|
| 11:24:57 | 16:54 | command poll | 200 / 200 | — |
| **11:29:59** | **16:59** | command poll | 200 / 200 | **DATA DELETE USERINFO ×410** |
| **11:35:01** | **17:05** | command poll | 200 / 200 | **DATA DELETE USERINFO ×685** |
| **11:40:01** | **17:10** | command result | 200 / 200 | **DATA DELETE USERINFO ×720** |
| **11:45:01** | **17:15** | command poll | 200 / 200 | **DATA DELETE USERINFO ×710** |
| **11:50:05** | **17:20** | command poll | 200 / 200 | **DATA DELETE USERINFO ×623** |
| 11:55:06 → 13:21 | 17:25 → 18:51 | polls, plus `upload OPERLOG` 12:18:47 and `upload ATTLOG` 12:48:31 | all 200 / 200 | none |

- **Total: 3,148 `DATA DELETE USERINFO` commands in about 25 minutes** (16:55–17:20 IST), and no other command type.
- **Not sent by our CRM.** The CRM never sends `DATA DELETE USERINFO`. CRM commands use IDs `9xxxxxxxx`, and the CRM's queue had 0 queued and 0 sent throughout (checked at 10:18, 13:06, 13:17 and 13:22 UTC).
- **Relayed by Vercel, not Cloudflare.** The nameservers moved at 12:37 UTC (registry), the zone activated at 12:43, and `www` was attached to the Worker after that. The batches came about an hour earlier, through the Vercel relay, which forwards the old server's replies unchanged, as designed.
- **Baseline:** none of the 25 contacts recorded before 10:18 UTC showed any old-server command. A similar pattern existed historically: the relay was given its verb counter to find out whether the old server rewrites users.

## 2. What happened on the device afterwards (MEASURED, read-only)
- **The device kept working.** Polls answered 200/200 throughout; it uploaded a user/operation log at 17:48 IST and punches at 18:18 IST. `lastError` is empty.
- **Punches continued.** Today's `accessEvents` hold **38 scans from 29 distinct device user IDs**, of which **34 were at or after 17:00 IST**, during or after the batches (17h IST: 12, 18h IST: 22). All are `UNKNOWN_USER` in the CRM, meaning old-system users not linked in the CRM. That's expected; nobody was denied.
- **3,148 deletes is about 6 times the 528 users** the device last reported (the CRM's mirror, from 30 Sep). So the commands most likely include PINs that weren't on the device, or the same PINs several times.
- **What the CRM can't tell:** whether any user actually present on the device was deleted. The relay doesn't record PINs (by design), and the device hasn't sent a full user list since 30 Sep. The 17:48 IST operation log was forwarded but only parsed for user names; no deletions are recorded from it.

## 3. What we can't see from our side
- Which PINs were deleted, and the device's answer (`Return=` code) to each command. The results went to the old server; the relay counts them but doesn't store them.
- Who or what queued the commands on the old server (a person, a sync job, an expiry run).
- Per-request detail in Vercel's logs: Vercel keeps runtime logs only briefly, so they're **probably gone**. Worth checking anyway (Vercel → Logs → `/api/iclock`, 5 Oct 11:25–11:55 UTC, search `upstreamCommands`).

## 4. Evidence to request from the old ADMS owner
1. **The old server's command log** for device `JJA1254700696`, 5 Oct **16:45–17:30 IST**: every `DATA DELETE USERINFO`, its `PIN=`, when and by whom (user or job) it was queued, and the device's result (`ID=…&Return=…`).
2. **The trigger:** was it a manual action (delete employees/clients, "sync users", "clear device"), a scheduled job (membership expiry, daily clean-up), or an import or bulk change in the old CRM around 16:50 IST?
3. **The PIN list's origin:** are the about 3,148 PINs past members, or the same PINs repeated (retries after `Return` errors)?
4. **The device's user count** in the old system before and after (and, if the old server queries it, from the device).
5. **Whether it's expected to recur** (every day? on each expiry run?), and whether it ever sends `DATA UPDATE USERINFO` afterwards (re-adding users).
6. **Did anyone report** being unable to enter on 5 Oct evening or since?

## 5. Read-only checks we can do ourselves (owner approval for anything at the device)
- **On the X2008 screen (view only, no change):** System Info → user count and fingerprint count, photographed. Compare with 528 users (30 Sep).
- **The CRM:** watch today's and tomorrow's `accessEvents` for regulars missing, or a jump in scans with a "not registered" result. The device only uploads accepted scans, so a deleted user shows up as **absence**, not as an error.
- **The harness baseline now counts `DATA DELETE USERINFO` as known.** A test monitor won't flag more of them as new. Proposal, not implemented: always flag `DELETE` verbs (and counts above a threshold) for review, whatever the baseline.

## 6. Why it matters for the X2008 test
The relay forwards the old server's commands unchanged, on Vercel and on Cloudflare alike. **The safety switch `ADMS_DELIVER_CRM_COMMANDS=0` stops only CRM commands; it doesn't stop these.** If the old server sends another batch during a test, the device will carry it out either way. The test must not start until §4 items 1–2 are answered, or the owner accepts the risk.

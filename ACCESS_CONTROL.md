# Access control and the eSSL X2008

How the gym's fingerprint device works with the Crunch CRM during the migration from the old
attendance software: what the device can and can't do, who controls whose access, how fingerprint
enrolment is confirmed, and what has to be tested at the device before any door is locked by the
new CRM.

For attendance (member visits, trainer check-in/out, the attendance check), see `ATTENDANCE.md`.

## 1. The path a scan takes

```
X2008 ──ADMS (HTTPS)──▶ www.crunnchhfitness.com/iclock/*  ──▶ old server 122.160.158.120:5072
                         (api/iclock.ts — the relay)        ◀── its reply goes back to the device
                                 │
                                 └─▶ Firestore: accessEvents, attendance, device users, command results
```

- **The relay forwards every request unchanged** to the old server and returns the old server's
  reply. The old system keeps working exactly as before.
- **Scans are only acknowledged if the old server acknowledged them.** If it's down, the device is
  told to retry, so neither system loses a scan.
- **The CRM can add its own commands** to the device's command poll. They use a reserved ID range
  (9 digits starting with 9), so their results are told apart from the old server's.
- **This X2008** (serial JJA1254700696) polls `/iclock/getrequest.aspx`. The `.aspx` paths are
  handled the same as the plain ones.

## 2. What the X2008 can and can't do

| Question | Answer | Evidence |
|---|---|---|
| Can the device ask the CRM before opening the door? | **No.** ADMS is a *push* protocol. The device matches the fingerprint and opens its lock output itself, then uploads the scan (`POST cdata?table=ATTLOG`). | Protocol design. Every scan reaches the relay after the fact; the relay's reply is just an upload acknowledgement. |
| Does it run commands sent by the server? | **Yes, at least for the old server, and very likely for the CRM.** | The device uploaded its full user list (528 users) through the relay on 2026-09-29. The CRM's `DATA QUERY USERINFO` request is the likely trigger. Confirm with the result code under **Sync user list** on the device card. |
| Does it create a user from `DATA UPDATE USERINFO`? | **Not yet confirmed on this device.** | The relay records the device's `Return=` code for each command, and Access → device card shows it. |
| Does it open its enrolment screen remotely (`ENROLL_FP`)? | **Not yet confirmed on this device.** | Same as above. If the device refuses, the CRM shows "Failed (code …)" and tells staff to enrol on the device; it never claims success. |
| Is there a separate access controller? | None found. The X2008 drives the door itself. | Wiring and installation to be confirmed at the gym. |

**What this means:** whatever the CRM decides about a scan is a **record and an alert**. It cannot
stop a door that has already opened. Stopping the door needs a change on the device itself, made
in advance (section 6).

## 3. Who controls whose access (migration safety)

The device holds users from **both** systems. Each device user's identity record
(`biometricIdentities/{deviceId}_{deviceUserId}`) says who controls it:

| `managedBy` | Set when | The new CRM… |
|---|---|---|
| `crm` | The CRM created the user on the device itself (a new device user ID it handed out), or staff explicitly chose **"Manage access in the new CRM"** for that person | judges their scans (allowed / not allowed + reason), and may send device commands for them |
| `legacy` (or missing, on all older records) | A person's **existing** device user ID was linked for attendance ("Already on the device (old system)") | records their scans and attendance only. **It never judges, disables, changes or deletes them.** |
| no identity record | The device user isn't linked to anyone in the CRM | records the scan as an unknown user. It never creates a member and never sends anything to the device. |

**The Firestore rules enforce this; it isn't just the screens:**

- **Claiming a user:** the CRM can't mark a user as `crm` if that user already exists on the device.
- **Device commands:** commands that change a device user (`add_user`, `enroll_fp`) are only
  accepted for a `crm`-managed user. Old-system users are refused.
- **Allowed commands:** only `query_users`, `add_user`, `enroll_fp` and `unlock_door` exist. The
  server builds the device text itself; nothing typed in the browser ever reaches the device.
  `unlock_door` may not name a device user.
- **Enrolment state:** the browser can only *request* enrolment. It can never set "confirmed".
- **Access switch:** the switch applies only to `crm`-managed users.

**There is no bulk operation of any kind.** Moving a person to the new CRM is one explicit,
confirmed step per person, and it's recorded in the activity log.

## 4. Access decisions (new-CRM users only)

`api/_lib/access.ts` makes the decision. Each scan stores it on the access event as `decision`,
`decisionReason`, `managedBy` and `result`:

| Situation | Decision | Reason code |
|---|---|---|
| Active membership, access on | `ACCESS_ALLOWED` | none |
| Membership expired | `ACCESS_DENIED` | `MEMBERSHIP_EXPIRED` |
| Membership marked inactive | `ACCESS_DENIED` | `MEMBERSHIP_INACTIVE` |
| Membership hasn't started yet | `ACCESS_DENIED` | `MEMBERSHIP_NOT_STARTED` |
| No membership | `ACCESS_DENIED` | `NO_VALID_MEMBERSHIP` |
| No membership, but a PT package (PT never includes gym entry) | `ACCESS_DENIED` | `PT_ONLY` |
| Staff block | `ACCESS_DENIED` | `MEMBER_BLOCKED` |
| Staff suspension | `ACCESS_DENIED` | `MEMBER_SUSPENDED` |
| The device user's access switch is off | `ACCESS_DENIED` | `ACCESS_DISABLED` |
| Old-system user | `LEGACY_USER` | none, and never a denial |
| Unlinked device user | `UNKNOWN_USER` | none, and never a denial |

- **Expiry doesn't remove the fingerprint.** It stays enrolled while the decision is "not allowed".
  After renewal, the same fingerprint is allowed again.
- **A not-allowed scan is still a visit or trainer attendance**, because the device let the person
  in. The dashboard raises it under **Needs attention**: "N entries today by someone whose access
  isn't allowed".

## 5. Fingerprint enrolment

States on the identity (`enrollment`):

| State | Meaning |
|---|---|
| `not_enrolled` | A new CRM user; nothing has happened on the device yet |
| `requested` | Staff pressed **Enroll fingerprint**; the request is queued for the device |
| `device_accepted` | The device answered `Return=0` to `ENROLL_FP`. This is **not** "enrolled" |
| `confirmed` | The device proved it, in one of two ways: it uploaded the fingerprint record (`FP PIN=…`; the template itself is never read or stored), or it verified a scan **by fingerprint** for that user |
| `failed` | The device refused, with its code (e.g. "Device answered -1002") |
| `unverified` | Linked old-system user, or a record from before this field existed. It becomes `confirmed` at their next fingerprint scan |

- **The old shortcut is gone.** The manual "Fingerprint saved on device" button no longer exists.
- **A user merely existing on the device no longer counts.** The device reporting the user (the
  old `SYNCED` status) doesn't mean the fingerprint is enrolled.
- **Every step is in the activity log:**
  - enrolment requested
  - device command carried out or failed
  - enrolment confirmed or failed
  - access turned on or off
  - access taken over by the new CRM

**Where staff do it:**

- **Access → device card → Open Biometric:** for a member or a trainer.
- **Member profile → Access → Biometric access:** Enroll / Re-enroll / Disable / Enable.
- **Trainer profile → Biometric:** the same actions.

## 5a. Open door (admin header)

Every admin page has **Open door** in the header. One click, with no member, ID or confirmation,
queues `unlock_door`. The relay sends it to the device as `AC_UNLOCK` on the device's next poll.

- **What the button shows:**
  - "Opening…" while the request is queued or sent
  - **"Door released"** only when the device answers `Return=0`
  - "Not opened (code …)" when the device refuses
  - "No answer from device" after 20 seconds
- **If the device is offline:** nothing is sent and the button says "Device offline".
- **Expiry:** a request the device hasn't collected within 30 seconds expires and is never sent.
  A door must not open later, for example when an offline device reconnects.
- **Fast delivery:** the relay listens for queued commands, so a request goes out on the next
  poll (about 3–4 seconds), not after the periodic check. `ADMS_COMMAND_LISTEN=0` turns this off.
- **Activity log:** both the request and the device's answer are logged ("Door release
  requested", "Door released by the device" / "…refused by the device").

**Not yet verified at the gym.** `AC_UNLOCK` is part of the ADMS protocol, but nobody has yet
confirmed that this X2008's firmware accepts it, or that its lock output is wired to the door.
Test it with someone at the door (section 7).

## 6. Locking the door for not-allowed users: NOT YET ENABLED

Nothing in the CRM currently stops the door, and the screens say so. To actually block a person,
the **device** must stop recognising them in advance. Options:

1. **Per-user access time zone or group.** `DATA UPDATE USERINFO PIN=… TZ=…` puts the user in a
   group with no allowed hours, and changing it back restores access. This is the right
   mechanism if this firmware honours it. **Not verified on this device.**
2. **Deleting the user** (`DATA DELETE USERINFO`). **Rejected.** It removes the fingerprint
   templates, so a renewed member would have to re-enrol.
3. **A separate access controller** in front of the lock. Only if option 1 isn't available.

**The old server could undo option 1.** It sends this device commands every few seconds. If they
include `DATA UPDATE USERINFO`, the old server could rewrite a user the new CRM had blocked. The
relay now records **which kinds** of commands the old server sends (verbs and counts only, never
user details). They show in **Settings → Access devices → Connection diagnostics** as "Old server
is sending: …". Check this before enabling option 1.

**Before enabling option 1 (do these in order, at the gym, with the owner):**

1. Check that the old server's commands don't rewrite users (above).
2. Use **one test member** enrolled by the new CRM. Send the block command to that one user only.
3. Confirm their fingerprint no longer opens the door.
4. Wait 30 minutes and confirm it's still blocked (the old server didn't undo it).
5. Re-enable the member and confirm the door opens again.
6. Only then build it into the "Disable access" action, for `crm`-managed users only. Never for
   old-system users, and never in bulk.

## 7. Physical tests before relying on any of this

Run each test with someone watching the device and the CRM side by side.

**Member (new CRM):**

1. In the CRM: Access → **Open Biometric** → choose the test member → **Start enrolment**.
2. On the device: does the enrolment screen open? Note the status the CRM shows (Sent → Place
   finger → Enrolled, or Failed with a code).
3. Place the finger. The CRM should show **Enrolled (confirmed by the device)**.
4. Scan. Access → Activity should show the scan as **Allowed**, and the member's Attendance tab
   should show the visit.
5. Expire the membership, or **Disable access**, then scan again. Check the result:
   - The scan is recorded as **Not allowed**, with a reason.
   - The dashboard flags it.
   - **The door still opens.** That's expected until section 6 is done.
6. Renew, or **Enable access**, then scan. It should be **Allowed** again.

**Trainer:**

1. **Open Biometric** → Trainer → choose the test trainer, then enrol as above.
2. Trainer profile → Biometric should show the device user ID and **Enrolled (confirmed by the
   device)**.
3. Scan twice. **Trainers → Attendance** should show check-in and check-out. Check that **no member
   visit** was created.

**Old-system user:**

1. Choose someone on the device who isn't in the new CRM. Scan.
2. Access → Activity should show the scan as **Unknown user** (or **Old system** if linked).
3. Check that **nothing changed** on the device for them, and that no request appears under the
   device card's "Recent requests".

**Open door:**

1. With someone at the door, press **Open door** in the admin header.
2. Check that the door releases, and that the button shows **Door released** (or the device's
   code). Access → device card → "Recent requests" shows "Open door".
3. If the device answers `Return=0` but the door doesn't move, the lock isn't driven by the
   device's lock output (wiring or settings). Check this with the installer.

**If remote enrolment fails with a code:** enrol on the device itself under the CRM's user ID
(Menu → User Mgt → New User → Fingerprint). The CRM confirms it at the first fingerprint scan.

## 8. Database load (Firestore quota)

The device polls every few seconds. Recording every poll used about 20,000 writes and 40,000 reads
a day on its own, which is the whole free-plan allowance. On 2026-10-01 production reads failed
with "Quota exceeded". The relay now:

- records a routine poll at most once a minute per server instance (`ADMS_ROUTINE_RECORD_MS`).
  Uploads, command results and errors are always recorded.
- listens for queued CRM commands, so a request reaches the device on its next poll. While the
  listener works, the periodic check is a 20-second safety net. Without the listener, the check
  runs every 10 seconds (`ADMS_COMMAND_CHECK_MS`).

The Firebase **Blaze** (pay-as-you-go) plan removes the daily cap. The gym's usage would cost very
little, but that's the owner's decision.

## 9. Indexes

**No new composite indexes are needed:**

- The device counts use equality-only filters.
- "Not allowed today" uses the existing `accessEvents (gymId, result, at)` index.
- Recent requests sort one field.

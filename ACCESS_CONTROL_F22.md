# Access control and the eSSL F22

How door access works in the Crunch CRM today, how the gym's eSSL F22 fingerprint device gets
connected, and how the old CRM is retired safely.

**Status as of 2026-09-29:** the CRM side is built. **No device is connected.** The F22 still runs
through the old CRM, and nothing in this repo changes the device's configuration.

## 1. How it fits together

```
Member ──▶ Access eligibility ──▶ Biometric identity ──▶ Device (F22) ──▶ Access events (scans)
  │        (membership rules)     (member ↔ device user ID)                  │
  └── Payments / PT (separate)                                                └──▶ Attendance
```

- **Eligibility** is worked out from the gym membership only (`src/lib/access/index.ts`,
  `accessEligibility`):
  - **Staff block or suspension** → not allowed. This always wins.
  - **Marked inactive** → not allowed.
  - **No membership on record**, including people with PT only → not allowed.
  - **Expired** → not allowed. **Active**, including the expiry day itself → allowed.
  - **A PT package never opens the door by itself.**
- **Biometric identity:** `biometricIdentities/{deviceId}_{deviceUserId}`. Each device user ID
  belongs to one member on one device. The rules make a second claim on the same ID impossible.
- **Devices:** `gyms/{gymId}/devices/{deviceId}`, any number per gym, readable only by that gym's
  admins.
- **Access events:** `accessEvents/{key}`. The key is built from gym, device, device user and
  time, so a scan that is reported twice is stored once.
  - Written only by the integration service; the rules refuse browser writes.
  - Kept separate from class check-ins on the Attendance page.

**What the browser can and can't do** (the rules enforce this):

| Staff can | Only the integration service can |
|---|---|
| Add or configure a device, enable or disable it | Mark a device online, or set its firmware, last sync or last error |
| Reserve a device user ID for a member (status `PENDING`) | Set `SYNCING`, `SYNCED` or `SYNC_FAILED` |
| Confirm "fingerprint saved on device" (`ENROLLED`) | Write access events (scans) |
| Disable or remove a device user (`DISABLED`, `REMOVED`) | |
| Block or suspend a member's access | |

So the admin never shows "Online", "Synced" or a scan unless the device actually reported it.
Until then it shows "Device integration not configured", "Waiting for first contact" and "Never".

## 2. The integration service

A small server near the device, which is not built yet. The F22 supports eSSL/ZKTeco's
**ADMS push** mode: the device makes outbound HTTP requests to a server address set in its menu.

```
F22 ──HTTP(S) ADMS──▶ ADMS listener ──▶ Access control service ──▶ Firebase ──▶ Crunch admin
        (outbound from the gym)       (Admin SDK credentials)
```

- **Where it runs:** a long-running HTTP listener, **not** inside the React app.
  - Either a small always-on machine at the gym, or a hosted endpoint the device can reach.
  - Vercel functions can answer ADMS polls, but a persistent service is simpler for device command
    queues. Decide during the pilot.
- **What's already written and tested:**
  - `src/lib/access/adms.ts`: `parseAttlog()` reads the F22's ATTLOG upload lines.
  - `processAttendanceEvent()`: turns a scan into granted, denied, access-disabled or
    unknown-user, using the member's eligibility at that moment.
  - `deviceEventKey()`: the duplicate-proof event id.
  - `AccessControlProvider`: the interface a vendor integration implements (`registerDevice`,
    `getDeviceStatus`, `enrollMember`, `disableMemberAccess`, `enableMemberAccess`,
    `removeMember`, `syncMember`, `processAttendanceEvent`, `getDeviceUsers`, `healthCheck`).
  - Today the app uses `NotConfiguredProvider`, which says so for every action.
  - `MockAccessProvider` exists for tests only.
- **Credentials:** the service authenticates to Firebase with a service account. Device and
  server secrets live only in the service's environment, never in Firestore documents the
  browser can read, and never in this repo.

**Check against the real device before building the listener.** Verify the firmware version,
the ATTLOG field order, the verify codes (fingerprint, face, card), timezone handling, and which
server-to-device commands are supported (adding or removing users, enabling or disabling a user,
remote enrolment).

## 3. Migrating off the old CRM

| Phase | What happens | Done when |
|---|---|---|
| 1. Now | The old CRM keeps running the F22. In the new CRM, staff add the device and link existing members to their **existing device user IDs**, using "Already on the device (old CRM ID)" when enrolling. | Every active member is linked to their current ID. |
| 2. Parallel | The integration service receives the F22's scans alongside the old CRM, if the device can push to two servers. If it can't, use exported logs from the old CRM. | Scans appear under Access control → Today's door scans. |
| 3. Compare | For 1–2 weeks, compare daily: scans per member, unknown device users, duplicates, missed scans, and who the old CRM let in against the new eligibility. | Differences are explained or fixed. |
| 4. Switch | Point the F22's ADMS server at the Crunch service only. Turn on eligibility sync, so an expiry or block disables the device user. | A full week with no unexplained denials. |
| 5. Retire | Export and archive the old CRM's data. Switch it off **only after the gym confirms** the data is no longer needed. | Owner sign-off. |

Nothing is deleted from the old CRM at any stage without the owner's go-ahead.

## 4. Steps at the gym (pilot)

Do these with the owner present. Write every setting down before changing it, so it can be put
back.

1. **Record what's there.** On the F22, open Menu → System Info. Write down the model, serial
   number, firmware version and user count. Then open Menu → Comm. → Cloud Server (ADMS) and
   photograph the current server address, port and settings. That's the old CRM's configuration.
2. **Add the device in the CRM.** Admin → Settings → Access control → **Add device**. Name it
   "Main entrance", model "eSSL F22", enter the serial from step 1, protocol ADMS. It will show
   "Waiting for first contact", which is correct.
3. **Link members to their existing IDs.** For each active member, open the member → Access →
   Enroll biometric → "Already on the device (old CRM ID)" → type their ID from the old CRM or
   the F22 user list → Reserve. If their fingerprint is already on the device, press
   "Fingerprint saved on device".
4. **New members:** Enroll biometric → "Give the next free number". Enrol the finger on the F22
   under that exact user ID (Menu → User Mgt → New User), then press "Fingerprint saved on device".
   - The CRM counter starts at 1, and IDs already taken are skipped automatically. If the old CRM
     already used low numbers, link everyone (step 3) before giving out new numbers.
5. **Wait for the integration service.** The server address, port and HTTPS settings for the
   F22's ADMS menu come with the integration service. **Don't change the ADMS settings until the
   service exists**; the old CRM depends on them.
6. **Test with one member** before switching everyone. One scan should appear once in Access
   control, with the right member and the right result.

## 5. Known limits

- No listener or service is deployed, so there are no real scans, sync or online status yet.
- Remote fingerprint enrolment from the browser isn't possible. Fingerprints are captured on the
  F22 itself.
- "Resync" and "Sync" are disabled until the integration exists.
- Existing staff accounts without a `gymId` belong to `crunch-wakad`. A second gym's admins need
  `userRoles.gymId` set to their own gym.

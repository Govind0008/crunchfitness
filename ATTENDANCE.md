# Attendance from the biometric device

How fingerprint punches from the entrance device become member visits and trainer attendance,
how the records are checked and repaired, and the paging and theme work that shipped alongside.
For the device connection itself (the ADMS relay, enrolment, diagnostics), see
`ACCESS_CONTROL.md`.

## Access vs attendance

**Member Access Activity and Member Attendance are separate representations of the same underlying biometric activity. A valid member punch must be resolvable into the member attendance system.**

| Layer | Collection | One document per | Written by | Shown in |
|---|---|---|---|---|
| Access (raw) | `accessEvents/{eventKey}` | punch | the relay only | Access → Activity |
| Member attendance | `checkins/{YYYY-MM-DD}_{memberId}` | member per local day | the relay (fingerprint), or front-desk staff | Attendance, member profile, dashboard |
| Trainer attendance | `trainerAttendance/{YYYY-MM-DD}_{trainerId}` | trainer per local day | the relay; admins may add a manual check-out | Trainers → Attendance, trainer profile, dashboard |
| Trainer leave | `trainerLeave/{id}` | leave period | admins | Trainer profile → Leave |

An access event is never deleted or rewritten. Attendance records hold the ids of the events
they're built from (`eventIds`), and each event holds the id of its attendance record
(`attendanceRef`). Either side can be traced to the other.

## Member flow

```
X2008 punch ─► /iclock/cdata?table=ATTLOG ─► api/iclock.ts
   │  forwards the request unchanged to the old attendance server (that doesn't change)
   └► api/_lib/ingest.ts  ingestScans()
        1. device user ID ─► biometricIdentities/{deviceId}_{uid}  (REMOVED links are ignored)
        2. accessEvents/{key}: personType 'member', memberId, result (the membership check),
           localDate, attendanceRef 'checkins/{day}_{memberId}', source 'adms-relay'
        3. checkins/{day}_{memberId} in a transaction:
             new      → method 'biometric', sources ['biometric'], at = first punch,
                        lastAt, punchCount, eventIds, deviceId, deviceUserId, gymId, createdAt
             existing → adds the new eventIds, widens at/lastAt, and keeps the sources
                        (a front-desk check-in on the same day becomes ['manual','biometric'])
        4. members/{id}.lastVisitAt moves forward (the Members list reads this field)
```

- A visit is recorded whatever the membership check says. The device decides whether the
  door opens, not the CRM. An expired member who punched in did visit. The access event
  keeps the result (`granted` / `denied`) for staff.
- The member profile reads visits with `checkins where memberId ==` (equality only, no
  composite index). It shows **This month**, **Last visit**, **Total visits** and the recent
  visits, with the source, the first and last time, and the punch count.
- The profile also reads the member's raw punches and compares them with the visits. If a punch
  has no visit, it shows **Attendance processing issue** with a link to the attendance check.
  If the punches can't be read at all (for example, the index is missing), it says so. It never
  shows 0.

### Why member attendance showed 0

The profile built "visits" from `accessEvents where gymId == … and memberId == … orderBy at desc`.
That query needs the composite index `accessEvents (gymId, memberId, at desc)`, which isn't in
production. The query failed, the error was caught with `.catch(() => setScans([]))`, and the
profile showed no visits. Nothing wrote member attendance from punches at all, and punches that
failed the membership check were left out of "visits" too.

## Trainer flow

**The X2008 entrance device provides biometric events but does not inherently determine physical entry versus exit direction. Trainer attendance therefore uses the first and last valid trainer punch for the local calendar day as attendance boundaries.**

A device user ID linked with `personType: 'trainer'` produces an access event (`personType
'trainer'`, `trainerId`, `result 'granted'`, reason "Staff"). It also updates
`trainerAttendance/{day}_{trainerId}`: the punch list, `eventIds`, and the fields worked out
by `trainerDay()` in `api/_lib/attendance.ts`.

### First/last punch rule

| Punches that local day | Status | Check-in | Check-out |
|---|---|---|---|
| none (no record) | `NO_ATTENDANCE_RECORDED` | — | — |
| 1 | `MISSING_CHECKOUT` | the punch | — (never invented) |
| 2 or more | `COMPLETED` | first | last |

- **Punches in between** stay access events. Arrival order doesn't matter, and the same punch
  counted twice is one punch.
- **Manual check-out:** an admin can close a `MISSING_CHECKOUT` day with a time after the
  check-in and a reason. The day becomes `COMPLETED` with the exception `MANUAL_CHECKOUT` and
  `manualCheckoutBy` / `manualCheckoutReason`, and the action goes in the activity log. If a real
  second punch arrives later, it replaces the manual check-out.
- **Leave:** leave is recorded by admins (from, to, type, reason, status, notes). A punch on a
  day covered by *approved* leave is flagged `PUNCH_DURING_APPROVED_LEAVE`. Leave recorded after
  the punch is flagged on screen as well. Pending or cancelled leave flags nothing.
- **Nothing is inferred:** there is no roster, shift, schedule or weekday logic. "No attendance
  recorded" never means "absent", because nothing says the trainer was expected that day.

Trainer punches never create member visits, and member punches never create trainer attendance.

## Local day and time zone

The device sends local wall-clock time (`2026-09-30 00:15:00`). The local day is taken from that
text directly (`localDay()`), so 00:15 belongs to 30 September and not to the UTC day before.
Instants are stored as ISO strings using the gym's fixed offset, +05:30. India has no daylight
saving time.

## Unknown device user IDs

A punch from a device user ID that isn't linked, or whose link was removed, is still stored.
It has `personType 'unknown'`, `result 'unknown_user'`, `attendanceRef null` and the name
stored on the device (`deviceUserName`). It creates no attendance.

- **Where staff see it:** Access → Activity → **Unresolved**, the dashboard's "Needs attention",
  and the attendance check (grouped by device user).
- **How it's linked:** in **Access devices → Match users**, staff choose the member (search by
  name, phone or member ID) or the trainer for each device user ID.
- **No name matching:** nothing is linked because two names look alike. The earlier
  name-similarity suggestions and the bulk "Link N suggested" button are removed, and so is
  the whole-members download they needed.
- **After linking:** new punches resolve at once. Earlier punches from that user are added by the
  attendance check's repair (below).

## Idempotency

- An event's id is `gymId__deviceId__uid__deviceTime`, so a re-delivered punch (an ADMS retry,
  a second upload) overwrites the same document.
- Attendance updates run in transactions and skip event ids they already hold, so re-delivery
  and repeat backfills change nothing.

## Attendance check and repair (reconciliation + backfill)

Access → **Attendance check** (admins only) calls `/api/adms?check=reconcile&from&to`. The range
is at most 92 days and at most 3,000 punches per check; if there are more, the result says so. It reports:

- **`missing_member_attendance` / `missing_trainer_attendance`:** a punch, with its current link,
  that isn't in the matching attendance record
- **`unknown_uid`:** device users that aren't linked, with a punch count and the name on the device
- **`duplicate_event`, `duplicate_attendance`:** the same punch stored twice, or two visits for
  one member on one day
- **`attendance_missing_member`, `attendance_wrong_gym`:** attendance for a deleted member, or
  for another gym

**Create missing attendance** (after a confirmation) calls `POST …check=backfill`. It runs the
same check and passes only the missing punches to `ingestScans(…, { writeEvents: false })`.
Attendance is created or extended, and the access events are left exactly as stored. The server
log records who ran it and the counts. Running it twice creates nothing.

Backfill strategy for history: link the device users first (Match users), then run the check a
month at a time and repair each month.

## Pagination

- **`usePaged(key, query, map, size)`** (`src/features/admin/usePaged.ts`): cursor pages with
  `limit(size + 1)` and `startAfter(lastDoc)`. The extra document only says whether a next page
  exists. There's no count query. React Query caches each page, keyed by the query key, the size
  and the cursor.
- **Resetting:** a new `key` (search, filter, day or sort) or a new page size goes back to page 1.
- **`<Pagination>`** (`kit.tsx`): Previous / Next, the page number, "Showing 51–100", and 25 / 50
  / 100 per page. It hides itself for a single short page.
- **Converted:**
  - Access → Activity
  - Attendance (visits for a day)
  - the Activity log
  - Members (the existing cursor, now with Previous and a page size; the first page stays in the
    shared cache)
  - trainer profile → Assigned members
- **Left as they are, deliberately:**
  - Payments: a date range capped at 500; the totals need the whole range.
  - Dues: a 90-day window capped at 500.
  - Enquiries: a live window.
  - Event registrations: one event's list; check-in and results need all of it.
  - Device users: one device's list, at most a few thousand; search narrows it.
  - Import history: owned by the legacy-import work.

## Theme

- **Tokens, not filters:** colours that change with the theme are CSS variables holding RGB
  channels, so Tailwind opacity modifiers like `bg-white/[0.08]` keep working. The variables are:
  - the whole `ink` scale
  - `white` (the text/foreground colour)
  - the text-only status shades (`amber-100/200`, `red-50…300`, `sky-100/200`, `brand-100/200`)
  - `brand-fg` for lime text
  - the shadcn HSL variables
- **Defaults:** the dark values are the defaults, so the public site renders exactly as before.
- **`src/index.css`:** `:root[data-theme="light"]` re-maps the scale rather than inverting it.
  950 is still the page background, 900 a card, and `white` the text.
- **Lime surfaces:** text on a lime surface uses `on-brand`, which is fixed near-black in both
  themes.
- **Where it applies:** `useStaffTheme()` (`src/lib/theme.ts`) sets `data-theme` on `<html>`
  while the admin or marketing shell is mounted, so dialogs, menus and drawers in portals follow.
  Leaving the staff area removes it, and the public site stays dark.
- **Choice:** Light / Dark / System, from the admin account menu or the Creative Desk sidebar.
  It's stored per browser in `localStorage['crunch.admin.theme']`; the default is Dark, and
  System follows the device setting live.

## Security

- **Admin-only reads:**
  - `trainerAttendance`
  - `trainerLeave`
  - `accessEvents`, `checkins` and `biometricIdentities` (these rules are unchanged)
  - device diagnostics (server-only)
- **Nobody else:** marketing, trainers, clients and the public get none of the collections above
  (see the emulator tests).
- **`trainerAttendance` writes:**
  - The browser can't create or delete a record, or change a punch.
  - A manual check-out needs all of the following:
    - the day is `MISSING_CHECKOUT`
    - the time is after the check-in
    - `checkoutAt == manualCheckoutAt`
    - a reason
    - `manualCheckoutBy == auth.uid`
    - server time on the update
  - Only the check-out fields may change.
- **`trainerLeave` writes:**
  - The dates must be valid, and `from` ≤ `to`.
  - The type and status come from fixed lists, and the trainer must exist.
  - The creator is stamped.
  - Leave can't be deleted; cancel it instead.
- **`biometricIdentities`:** a trainer link must name an existing trainer and no member.
- **Server endpoints:** `/api/adms` reconcile and backfill check the caller's ID token plus
  `userRoles/{uid}.role == 'admin'`.
- **Fingerprint data:** fingerprint templates are never stored or logged. They're counted in
  diagnostics and dropped.

## Indexes

The list is in `FIREBASE_INDEX_AUDIT.md`, "Attendance, access and paging". The one that caused
the 0 is `accessEvents (gymId, memberId, at desc)`, which is in the file but missing in
production.

## Known limitations

- **Entry vs exit:** the device can't tell them apart (see above). A trainer who punches only
  on the way out gets a check-in with no check-out.
- **Stored results:** an event's `result` and `personType` are stored as they were at the time
  of the punch. Linking a user later doesn't rewrite old events; the repair adds their
  attendance instead.
- **Attendance check limits:** one check reads up to 3,000 punches; narrow the range if the
  result says it's truncated. The emulator doesn't enforce indexes, so the tests can't prove an
  index exists.
- **Old front-desk visits:** these don't have `sources`. The Front desk filter uses
  `method == 'manual'`, which covers them.
- **Live location:** the relay runs on Vercel (bom1). Production attendance starts with the first
  punch after this is deployed. Earlier punches need the repair.

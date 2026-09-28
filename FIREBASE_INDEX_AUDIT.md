# Firestore index audit

Every Firestore query in the app (`src/`, `api/`) was checked against Firestore's indexing
rules, and indexes are listed only where a query actually needs one. Firestore builds
single-field indexes automatically, and it serves queries that use only equality filters
(`==`, `in`) by merging those single-field indexes.

A **composite index** is needed only when a query filters or orders on more than one field,
with at least one range filter or sort. A **collection-group** query needs a single-field index
turned on for the collection-group scope. That index is not created automatically.

The emulators don't enforce indexes, so the emulator tests can't prove an index exists.

Checked 2026-09-28, branch `redesign/premium-motion`.

## Indexes in `firestore.indexes.json`

| # | Collection | Fields | Scope | Query that uses it | Status |
|---|---|---|---|---|---|
| 1 | `payments` | `paidOn` ↑, `countedPaise` ↑ | collection | `revenueBetween()` in `src/lib/admin/payments.ts`: `sum('countedPaise')` over a `paidOn` range. Used by the dashboard, Revenue and the 12-month trend. | **Exists in the live project** (created from the console link on 2026-09-28). |
| 2 | `classSessions` | `date` ↑, `startTime` ↑ | collection | Admin → Classes (`AdminDashboard.tsx`): `where('date','==',d)`, `orderBy('startTime')`. | Existing query, older than this work. Probably already in the console because the Classes tab works, but **check**. |
| 3 | `classSessions` | `trainerId` ↑, `date` ↑, `startTime` ↑ | collection | Trainer portal (`TrainerDashboard.tsx:201`): today's classes for one trainer. | Existing query. **Check it's in the console.** |
| 4 | `sessions` (under `trainerData/{id}/`) | `clientId` ↑, `date` ↓ | collection | Trainer portal (`TrainerDashboard.tsx:272`): one client's PT sessions, newest first. | Existing query. **Check it's in the console.** |
| 5 | `registrations`, field `phoneKey` (field override) | `phoneKey` ↑ | **collection group** (plus the three default collection-scope indexes kept as they are) | Member profile → Events (`MemberProfile.tsx`): one `collectionGroup('registrations')` query across all events. | **New — deploy it.** Until it's deployed the profile falls back to the old query-per-event loop, so nothing breaks. |

Indexes 2–4 were never recorded in the repo. They're added so the file matches what the app
needs, and so `firebase deploy --only firestore:indexes` can't offer to delete them.

## Queries that need no composite index

| Area | Query | Why no index |
|---|---|---|
| Members list | `orderBy('nameLower')`; `activeUntil` range + `orderBy('activeUntil')`; `startAfter` pagination | Filters and sort use the same single field. |
| Member counts | `getCountFromServer` on `activeUntil` ranges; `membershipEnd != null` | Single field. |
| Member search | prefix range on `nameLower` / `phoneKey` / `emailLower`, `limit(20)` | Single field. |
| Duplicate phones | `phoneKey in [...]` (batches of 30) | Equality only. |
| Dues | `activeUntil` range + `orderBy('activeUntil')`, `limit(500)` | Single field. |
| Payments list | `paidOn` range + `orderBy('paidOn')`, `limit(500)` | Single field. |
| Member payments | `memberId ==`, `limit(100)` (sorted in the browser) | Equality only. |
| Receipt lookup | `receiptNo ==` | Equality only. |
| Check-ins | `checkedInAt >=` + `orderBy('checkedInAt')`; counts since a date | Single field. |
| Class attendees | `sessionId ==` | Equality only. |
| Member check-ins | `memberPhoneKey ==`; `memberPhone in [...]` | Equality only. |
| Profile class names | `documentId() in [...]` | Equality only. Replaces up to 10 separate reads. |
| Trainer overview | `members.trainerId ==` count; `sessions.date >=` count | Single field. |
| Dashboard | events `status in`; enquiries `status ==` count; duties `weekStart ==` count; overdue `activeUntil` range count; today's revenue (index 1) | Single field or equality only, except revenue. |
| Enquiries badge | `read == false` listener | Equality only. |
| Events (public) | `status in`; `slug ==` + `status in` | Equality only (merged). |
| Event admin | `orderBy('eventDate')`; per-event `registrations orderBy number`, `media orderBy createdAt`, `activity orderBy at` | Single field. |
| Results | `public == true` | Equality only. |
| Blog (public) | `published == true`, sorted in the browser | Equality only. It no longer uses `orderBy('publishedAt')` on every post; see Security below. |
| Blog post | `slug ==` + `published ==` | Equality only. |
| Marketing desk | posts `published ==` counts; highlights `visible ==` count; events `status in` | Equality only. |
| Staff access | `userRoles.role in ['admin','marketing']`; `role == 'trainer'`; `role == 'admin'` count | Equality only. |
| Trainer portal | duties `trainerId ==` + `weekStart ==`; roles `trainerId ==` + `role ==`; attendance `sessionId in` | Equality only (merged). |
| Activity log | `orderBy('at')`, `limit(100)` | Single field. |
| Global search | events `orderBy('eventDate')`, `limit(100)`; enquiries `orderBy('submittedAt')`, `limit(300)` | Single field. |

## Possibly unused indexes

None of the indexes in the file are unused. The Firebase console may hold indexes created by
hand in the past that aren't listed here. The console couldn't be reached from this
environment, so they weren't checked.

**Don't delete any console index** until someone has compared it with this table. If
`firebase deploy --only firestore:indexes` offers to delete an index that isn't in the file,
answer **No**.

## Performance notes from the same audit

- **Legacy dashboard (Blog, Team, Offers, Plans, Enquiries, Roster, Classes, Trainer
  logins):** it used to open all eight live listeners on every visit, including every
  account's role document.
  - Each section now opens only the listeners it needs, and closes them when you leave.
  - The trainer-logins listener now reads only `role == 'trainer'` documents.
- **Member profile → Events:** up to 50 events used to mean up to 100 reads (one
  registrations query plus one result read per event). It's now one collection-group query
  plus reads only for events the member actually entered.
- **Member profile → Attendance:** class names came from one read per check-in (up to 10).
  They now come from one `documentId() in` query.
- **Revenue totals:** each figure took two server round trips (`sum` and `count`). Both now
  come from one `getAggregateFromServer` call. The Revenue page drops from 32 aggregate
  requests to 16.
- **Plans and trainers lookups:** these were re-read on every admin page. They're now shared
  across pages for 30 seconds, and dropped immediately when plans or team profiles change.
- **Still whole-collection reads:**
  - The Reports → Members CSV export downloads every member. That's an explicit, on-demand
    export, so it stays.
  - Plans, team members and offers are read whole, but they're small, public collections.

## Legacy import, PT and membership history (added 2026-09-28)

**No new composite indexes are needed.**

| Query | Collection | Why no index |
|---|---|---|
| `memberId ==` (member profile: membership history) | `memberships` | Equality only; sorted in the browser |
| `memberId ==` (member profile: PT) | `ptPackages` | Equality only; sorted in the browser |
| `trainerId ==` (trainer's own PT packages, allowed by the rules) | `ptPackages` | Equality only |
| `legacy.key in [...]` (≤30 per query: "already imported?") | `payments` | Equality on a nested field; single-field index is automatic |
| Whole collection (import history; one small document per import) | `imports` | No filter |
| `activeUntil >=` 90 days ago and `< today` (dues and overdue count) | `members` | Range on a single field |
| `paidOn` range (today's and last month's payments, for the membership/PT/other split) | `payments` | Existing single-field range, `limit(500)` |

The membership / PT / other revenue split is added up in the browser from those bounded lists.
It isn't a per-type `sum()`, which would need a new `(paymentType, paidOn, countedPaise)` index.

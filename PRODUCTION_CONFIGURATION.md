# Production configuration

What the Crunch Fitness app needs in production, and how to deploy it safely. This file holds
no secrets: tokens and passwords belong only in Vercel's environment settings.

## 1. Services

| Service | Used for | Where configured |
|---|---|---|
| **Vercel** | Hosts the site (Vite build) and two serverless functions: `api/instagram.ts` (Instagram feed) and `api/sitemap.ts` (sitemap with events) | Project settings. `main` deploys to Production through the GitHub integration. |
| **Firebase Auth** | Email/password sign-in for admins, marketing, trainers and clients | Firebase console → Authentication |
| **Cloud Firestore** | All data | `firestore.rules`, `firestore.indexes.json` |
| **Cloudinary** | Photo and video uploads (blog covers, team photos, event media) | Unsigned upload preset `crunchfitness_upload` on cloud `dkvlsn98d` (`src/lib/cloudinary.ts`) |
| **Instagram Graph API** (optional) | Latest posts on the homepage; when it's not configured, staff-picked highlights are shown instead | Vercel environment variables |
| **WhatsApp** | `wa.me` links (enquiries, receipts). No API and no credentials. | Numbers in `src/lib/site.ts` |
| **Email** | **Not set up.** No email service is connected. Receipts are shared through WhatsApp or as a saved PDF. | — |

## 2. Environment variables

| Variable | Where | Required | Secret | Purpose |
|---|---|---|---|---|
| `INSTAGRAM_USER_ID` | Vercel (server only) | Optional | No | Instagram account whose posts the homepage shows |
| `INSTAGRAM_ACCESS_TOKEN` | Vercel (server only) | Optional | **Yes** | Long-lived token. It expires after 60 days; the function reports `token_expired` when it has. |
| `VITE_FIREBASE_EMULATORS` | Local tests only | No | No | `1` points the app at the local emulators. **Never set it in Vercel.** |

About the keys that are written into the code:

- **Firebase web config** in `src/lib/firebase.ts` (API key, project `crunch-fitness-blog`):
  public by design. Firebase web keys identify the project; they don't grant access. The
  Firestore rules are what protect the data.
- **Cloudinary** cloud name and unsigned preset: public by design. Unsigned presets are meant
  for browser uploads.
  - To stop strangers uploading to the account, limit the preset in Cloudinary to image and
    video formats and a maximum file size, and consider a dedicated upload folder.

## 3. Firestore rules

The source of truth is `firestore.rules`.

**Roles** live in `userRoles/{uid}.role`:

| Role | What it can do |
|---|---|
| `admin` | Everything |
| `marketing` | Public content only: blog, offers, team profiles, event page text and media, Instagram highlights |
| `trainer` | Their own portal data |
| `client` | Their own trainer's data |

Only admins write roles, and an admin can't demote or delete their own role.

**What this version changes compared with the rules published on 2026-09-28:**

- **New `marketing` role.**
  - Can write: posts, offers and teamMembers (create and update only; deleting a trainer is
    admin-only), socialHighlights, event media, event activity entries, and the public text
    fields of events.
  - Can also create draft events.
  - Can't change an event's status, dates, registration settings, capacity or counts.
- **Blog drafts are private.** Only published posts are publicly readable. Before, anyone could
  read a draft through the Firestore API.
- **Duty roster** is readable by admins and trainers only. Before, any signed-in account could
  read it.
- **`settings`** is readable by admins only.
- **Admins can't remove or demote their own role document**, so nobody locks the gym out by
  mistake.
- **Payments:** the optional discount fields `discountPaise` and `listPricePaise` must be
  whole, non-negative paise.
- **Collection-group read of `registrations`** for admins, used by the member profile.

**Deploy order matters.** Deploy the app first, then publish the rules.

- The current live blog page reads every post, drafts included. The new rules refuse that, so
  publishing the rules before the new code is live would empty the public blog until the
  deploy finishes.
- The new code works with both the old and the new rules.

Publish with `firebase deploy --only firestore:rules`, or paste `firestore.rules` into
Firebase console → Firestore → Rules → Publish.

**Legacy import / PT additions** (details in `LEGACY_MEMBER_IMPORT.md`):

- **New collections, admin-only:**
  - `memberships`: create and update, never deleted.
  - `ptPackages`: trainers can also read their own; never deleted.
  - `imports`: append-only.
- **Imported payments:** a second payment `create` path.
  - `source == "legacy_excel"`, id `lx_…_p`, no receipt number, method may be `"unknown"`.
  - Normal payments are unchanged, except that they may now carry a `paymentType`.

**Access control and member photos** (details in `ACCESS_CONTROL_F22.md`):

- **New Firestore areas:**
  - `gyms/{gymId}/devices`: admins of that gym only.
  - `biometricIdentities`: one document per device user ID. Staff statuses only; never "synced"
    from the browser.
  - `accessEvents`: read-only for admins, written by the integration service.
  - Members: `accessOverride` and `photo` metadata are validated.
- **Firebase Storage:** member photos are private at `members/{id}/photo`, admins only
  (`storage.rules`, which also closes every other path).
  - Deploy with `firebase deploy --only storage`.
  - Storage must be enabled on the project first (Firebase console → Storage). Until it is, member
    photos show a clear "not set up" message and the member is still saved.

**Manual check-ins without a class** (added with the consistency pass; required, because Classes
are no longer in the admin):

- **New collection `checkins/{YYYY-MM-DD}_{memberId}`**: one front-desk check-in per member per
  day. Fields: `memberId`, `memberName`, `memberPhoneKey`, `date`, `method` (`"manual"`), `by`
  (the admin's uid), `at` (server time).
- **Rules:** admins read and create only. The id must match the date and member, `by` must be the
  signed-in admin, `at` must be the server time, and the member must exist. No updates. Admins may
  delete a mistaken record. Marketing, trainers and the public have no access.
- **Existing data is untouched.** `attendance` records from the class-PIN page (`/checkin`) are
  still read and shown as "earlier self check-in". `classSessions` and `duties` are no longer
  shown in the admin, but they aren't deleted, and the trainer portal and `/checkin` still use them.
- Until these rules are published, front-desk check-in fails with a permission error. Nothing is
  written anywhere else.

## 4. Firestore indexes

See `FIREBASE_INDEX_AUDIT.md`. Deploy with `firebase deploy --only firestore:indexes`.

- If the CLI offers to **delete** indexes that aren't in the file, answer **No**, then look
  those indexes up in the audit.
- The payments revenue index already exists.
- The collection-group `registrations.phoneKey` index is new. Until it's built, the member
  profile falls back to the slower lookup, so nothing breaks.

## 5. Staff accounts

- **Admin:** set `userRoles/{uid}` to `{ role: "admin" }` in the Firebase console. This is the
  only step that needs the console.
- **Marketing:** Admin → Settings → Staff access → Add marketing login. They sign in at
  `/marketing/login`.
- **Trainer:** Admin → Trainers → Portal logins.
- **Client:** created by each trainer in the trainer portal.
- Account creation from the admin uses email/password sign-up, so **Authentication → Sign-in
  method → Email/Password** must stay enabled.
  - That also lets anyone create a sign-in through the API. Such an account has **no role**,
    and the rules give no role nothing beyond what the public already has, so it's harmless.

## 6. Deploy steps

1. `npm ci && npm run build`. The build must pass.
2. `npm run test:events` (emulators) and `npm run test:e2e` (site, read-only against
   production).
3. Merge to `main`. Vercel deploys Production automatically.
4. When the deploy is live, publish `firestore.rules` (section 3), then deploy
   `firestore.indexes.json` (section 4).
5. Check signed in as an admin:
   - `/admin` loads.
   - Revenue shows totals.
   - A member profile shows events.
   - Settings → Gym setup shows 6 of 7 steps done, with access control waiting.
6. Check signed in as a marketing account:
   - `/marketing` loads.
   - `/admin` says "This is a marketing account".

## 7. Money, receipts and tax

- Amounts are stored as whole paise. Totals are server-side `sum()` over `countedPaise`, which
  is 0 once a payment is voided.
- Receipts are numbered `CR-R-0001` onwards from `counters/receipts`. The rules make the
  counter move by exactly one with each payment, so numbers are never reused.
- Payments are never edited or deleted, only voided with a reason. Voided receipts stay in the
  history and reports.
- **Discounts:** the plan price and the discount are stored as snapshots on the payment. The
  plan's own price never changes.
- **Not built yet — part payments with a tracked balance.** This is the next controlled
  change. Today a balance paid later is just another payment. The planned model:
  - a `billingId` shared by every payment for one billing period
  - an agreed amount (`duePaise`, after discount) stored on the first payment
  - outstanding = `duePaise` − the sum of paid `amountPaise` with that `billingId`, computed on
    the server
  - Dues would then show "Outstanding" only for real balances. Today it shows only
    "Estimated renewal".
- **GST / tax:** not configured (`GYM.payments.tax = null` in `src/lib/gym.ts`).
  - Receipts say "Payment receipt — not a tax invoice".
  - When the gym's GSTIN and tax treatment are confirmed, fill in `tax` and add the tax lines
    to the receipt. Don't invent a GSTIN or a rate.

## 8. Provisioning another gym

`src/lib/gym.ts` (`GYM`) is the typed gym configuration:

- name, logo, address, postcode, phone, email, WhatsApp
- timezone, currency, hours
- receipt prefix, payment methods, tax
- access-control provider

For Crunch it comes from `src/lib/site.ts`, so nothing is duplicated. To run a second gym:

1. Move the same shape into Firestore as `gyms/{gymId}`, readable by staff and writable by
   admins, and load it once at start-up in place of the constant.
2. Add `gymId` to the per-gym collections (members, payments, attendance, classSessions,
   counters, settings), or give each gym its own Firebase project. Separate projects are
   simpler and isolate data completely.
3. Walk through Admin → Settings → Gym setup: details, admin users, plans, trainers, payment
   settings, access control, branding.

Existing Crunch data needs **no migration** until a second gym actually exists.

## 9. Door access (biometric) — prerequisites

**Nothing is connected, and the app doesn't pretend otherwise.**

- `src/lib/access/` defines the layers:
  - access eligibility, computed from membership only (active, not expired, expiry date set)
  - device sync status (`ACCESS_ACTIVE`, `ACCESS_DISABLED`, `ACCESS_PENDING_SYNC`,
    `ACCESS_SYNC_FAILED`, `ACCESS_UNKNOWN`)
  - an `AccessControlProvider` interface
  - a duplicate-proof key for device punches
- The only implementation is a **mock used in tests** (`src/lib/access/mock.ts`). The app never
  imports it.
- **Intended architecture:**
  - Firebase (membership) → access integration service (server side) → local gym connector
    (on the gym's LAN, calling out only, with no open inbound ports) → device
  - The browser never talks to the device and never holds device credentials.

**Needed from the gym before building the real connector:**

1. Device make, model and firmware version.
2. How it integrates: an SDK, an HTTP API on the LAN, a vendor cloud API, or file export.
3. Whether members are enrolled on the device (fingerprint or face) or by card/PIN, and what
   stable ID the device gives each person.
4. Network: does the device sit on the gym's LAN, and can a small always-on PC or Raspberry Pi
   run the connector next to it?
5. **Business rules:**
   - access on the expiry day
   - grace days after expiry
   - what happens when a sync fails (keep the last state? deny?)
   - who can override
6. Where device credentials will live. Only in the connector's own environment, never in
   Firestore documents the browser can read.

## 10. Open items needing the owner's confirmation

| Item | Current state | Needed |
|---|---|---|
| Domain | `SITE.url` is `https://www.crunchfitness.fitness`, but that domain doesn't resolve, so the live site is only on the `.vercel.app` address. | Register or connect the domain in Vercel, or confirm the correct domain, then update `SITE.url`. |
| Address / postcode | The website, structured data, receipts and event pages say *2nd floor, Palash Plus, C Building, Opposite Euro School, Wakad, Pune 411050*. The chatbot (`src/components/Chatbot.tsx`) says *Pink City Road, Wakad, Pune - 411057*. | Confirm the official address. Then change `src/lib/site.ts` and the chatbot; every other place reads from `site.ts` / `gym.ts`. |
| `4@gmail.com` role | Earlier seen with `role: "admin"`. | Confirm the intended role, then change it in Settings → Staff access or in the console. |
| Instagram | Env vars not set in Vercel. | Add `INSTAGRAM_USER_ID` and `INSTAGRAM_ACCESS_TOKEN`, or rely on the staff-picked highlights. |
| Class PINs | `classSessions` are publicly readable (needed for `/checkin`), including the `pin` field. | Consider moving the PIN into a document only the check-in transaction can read, if remote check-ins become a problem. |

# Importing the old member sheets

This guide covers moving the gym's old spreadsheets into the admin as members, membership
history, personal training (PT) packages and payments. It's written for whoever runs the
migration: the gym owner or an admin, plus a developer for the one-off steps.

Two workbooks have been checked:
- **SEPTEMBER2026.xlsx → the `Membership` sheet only** (section 0). The workbook's other sheets
  (Enqury, PT Sheet, Renewal, oct renewals, Sheet1) are not read.
- **Member details.xlsx** (sections 1 onwards), the older 15-row sheet.

Where it happens: **Admin → Members → Import → "From the old member sheet"**.

## 0. SEPTEMBER2026.xlsx — the Membership sheet

Checked on 2026-09-30.

**Shape:** 105 rows under the header (sheet rows 2–106); rows 107–200 are empty.

| Column | Contains | Goes to |
|---|---|---|
| Sr.No | 1–88, **restarts at 55** part-way | `legacy.srNo`, for reference only. The sheet row identifies a row. |
| Members Name | mixed case, trailing spaces | member name (trimmed, otherwise as written) |
| Mob Number | numbers and text (`"9000000001"`); 4 rows blank | phone — the matching key |
| Date of payment | Excel dates; 2 rows blank | payment date |
| Membership | `1 month`, `1months`, `6month`, `12+1`, `6+2 months`, `12 months upgrade`, `1day`, `01 month pt`, `03 months PT`… | membership **or** PT, with the original label kept |
| Start Date / End Date | Excel dates; blank for day passes and some PT; `2/4/20274` in 3 rows | period dates, **as written** |
| Paid | whole rupees | payment amount |
| Bal Amt | `AM(A/C)`, `NH (A/C)`, `2000 bal`, `nil`, `nill AM(A/C)`, `bal paid`, `17000 AM(A/C)`, `BFN` | `legacyBalanceText` (+ `legacyBalanceAmountPaise` for a leading number). **Never a due.** |
| Mode | `upi`, `UPI`, `upi `, `cash`, `CASH`, `card`; some blank | payment method; blank → "Not recorded" (raw text kept in `legacy.methodRaw`) |
| comment | free text ("renew monthly till diwali 16/9", "paid for sanjeevani bose") | payment notes + `legacy.comment`. Never acted on. |

**What the importer finds** (the numbers shown before importing):
- 105 rows, **94 people**: 92 distinct phones, plus 2 phone-less names nobody else has.
- 101 rows with a phone, 4 without.
- 81 gym-membership rows and 24 PT rows.
- 82 rows import as they are, 19 wait for a decision, 4 can't be imported.

**A row is a payment, not a member.**
- Rows are grouped by phone into one member.
- Rows of one member with the **same package and the same dates** are one membership (or PT
  package) with several payments:
  - Rani Singh: ₹4,000 + ₹2,500.
  - Tejas Kharade: ₹4,000 + ₹4,000 on different dates. This is not a duplicate.
  - Prasad Gaikwad, `12+1`: ₹6,000 + ₹4,000.
- Different packages stay separate records:
  - One member: 6 months, then the "12 months upgrade".
  - Aniket Hingnekar: a gym membership and a PT package.
- Day passes are always separate visits. One member has three.
- **No row is deleted or merged away.** Each stays one payment that names its sheet row.

**Packages.**
- `6+2 months` → base 6 + bonus 2 = 8 months (`packageType: bonus`); `12+1` → 13; `12+2` → 14.
  The plan link uses the base months.
- `… upgrade` → `packageType: upgrade`. Its own dates are used, and nothing is assumed about the
  earlier membership.
- The original wording is stored as `originalPackageLabel`, alongside `normalizedDuration`
  ("8 months", "1 day").

**Rows waiting for a decision (19).** Each has a single "Decision" choice; leaving it on
"Leave out for now" keeps the row out.

| Rows | Why | Choices |
|---|---|---|
| 8, 19, 20, 77, 91, 97 | Dates don't fit the package (6 months ending after 30 days, 14 months ending the same day) | keep the sheet's dates, or start + the package's months |
| 15, 16, 17 | End date `2/4/20274` isn't a date (start + 7 months = 02/04/2027) | import without an end date, or start + 7 months |
| 24 | 6 months with no dates ("will start after 1months") | import undated (not active until someone sets dates) |
| 54, 89 | "Paid for vijay jamdade" / "paid for sanjeevani bose" | import under the Members Name as written |
| 59, 66, 91 | Amishi khare appears with two different phones | import as two members (phones decide) |
| 69, 93, 94 | Paid 90–99 days before the start | import as written |
| 90 | Rashmi Nimje, undated PT, "bal paid" | a second payment for the row 85 package |
| 104 | Name spelt differently, no phone; exact name match with row 96 | add to the member on row 96 |

**Can't be imported (4)**, listed in the report with the reason:
- Rows 64 and 65 (avinash patil, Dishant patil): no phone and no member with that name.
- Row 71 (Chaitanya shinde): no payment date.
- Row 81 (Dishant patil): no phone and no payment date.

To bring them in, add the missing value in the sheet and import it again.

**Colours** are kept as `legacy.highlight` and not interpreted. The sheet has no key; these are
only patterns, to confirm with the owner:
- yellow on rows whose Bal Amt starts with a number;
- green on PT rows;
- blue on later instalments ("first payment date 31/7", "bal paid");
- cyan on upgrades;
- pink on "paid for …" rows.

## 1. What the sheet contains

Checked on 2026-09-28.

**Shape:** one sheet ("Sheet1") with 15 rows under the header.

| Column | Contains | Notes |
|---|---|---|
| Sr No | 1–14 | Row 15 (Shiwang Kumar) has none; the sheet row number is kept instead. |
| Name | lower-case names, some with trailing spaces | Trimmed. Otherwise kept as written. |
| Mob Number | stored as numbers (9881715183) | Normalised to 10 digits. All 15 are valid mobiles. |
| Date of payment | Excel dates, 1–6 Sep 2022 | |
| Membership | `01 month`, `6 month`, `12 month`, `01 month pt` | |
| Start Date / End Date | Excel dates, Aug 2022 – Sep 2023 | Every period ended in 2022–23. |
| Paid | whole rupees (2,000–15,000) | |
| bal | blank, `nill`, `bal paid`, `9000`, `24 session` | Kept as a note. It is never treated as money owed. |

**What's in it:**
- 13 people. Aditya Ajayshankar and Ankit Naik each have a gym membership row and a PT row.
- 11 gym-membership rows and 4 PT rows (all four say "01 month pt").
- 15 payments, totalling ₹89,000, of which PT is ₹34,000.

**Colours:** there is no key for what the colours mean, so they're kept as evidence and not
interpreted.
- Green: all 4 PT rows.
- Blue: Monal Khurasiya, Sandeep Patil and Rahul Jadhav.
  - Each was paid 16–35 days after its start date.
  - Each has `bal` = "bal paid" or "nill".
  - They're flagged as "may be the rest of an earlier payment", but still imported as the
    money received on that date.

**Row 8, Neha Goyal, PT** has Paid ₹5,000 and bal `9000`.
- The 9000 is stored as an unconfirmed old balance (`legacyBalanceAmountPaise`), shown as a
  warning. Since the Membership-sheet update it no longer needs a decision.
- It is never shown as a due.

**Exact duplicate rows:** none. (Exact repeats are never dropped: they wait for a decision,
because a repeat can be a real second payment.)

## 2. Column mapping

The importer detects these columns and staff can correct any of them before importing.

| Sheet | Goes to |
|---|---|
| Name | member name |
| Mob Number | member phone (the matching key) |
| Date of payment | payment date |
| Membership | membership period **or** PT package |
| Start Date / End Date | period start and end |
| Paid | payment amount (stored in paise) |
| bal / Bal Amt | `legacyBalanceText`, plus `legacyBalanceAmountPaise` when it starts with a number (older imports used `legacyBalanceNote`) |
| Mode | payment method (blank → "Not recorded") |
| comment / Feedback comment | payment notes and `legacy.comment` / `legacy.feedback` |
| Sr No | `legacy.srNo` (for reference) |

## 3. Membership vs PT

- **PT:** text containing "pt", "p.t." or "personal training" plus a number of months, e.g.
  "01 month pt", becomes a **PT package** (`ptPackages`). It is never a gym plan.
- **Gym membership:** just a number of months ("01 month", "6 month", "12 month", "annual")
  becomes a **membership period** (`memberships`).
- **Anything else** ("pt" alone, "gym + pt 3 month", "zumba", blank) is **Not sure** and waits
  for staff to choose the type.
- **Imported PT packages leave out:** the trainer, the number of sessions and the package price.
  The sheet doesn't say, so none of these are invented.
  - "24 session" in `bal` stays a note only.

## 4. Matching members

- **By phone:** the last 10 digits, the same rule the rest of the admin uses. `+91 98817 15183`,
  `098817-15183` and `9881715183` are the same person.
- **Same phone, different name** within the sheet: that row waits for review.
- **Phone matches an existing member:**
  - The rows are attached to that member.
  - **Nothing on the member is changed.**
  - Name or expiry differences are shown as conflicts.
- **No phone:**
  - If exactly one person in the sheet (or one existing member) has the same exact name, the
    row waits for a decision ("possibly the same person").
  - Otherwise it can't be imported.
  - Members always need a phone.
- **Same name, different phones:** separate members, flagged for a decision.
- **Same phone, name spelt a little differently** (e.g. "Amit Shah" / "Amit Shaw"): one member, with a note.
- Names alone never merge two people.

## 5. History stays history

- A new member's plan and dates come from their latest membership row.
- Active or expired status comes from those dates, so everyone in this sheet is **expired**.
- **People with only PT, day-pass or undated rows** (Vishal Varuka, Neha Goyal; Dhanashri
  Mahajan in the Membership sheet) are added as **inactive** members, with a note saying so.
  They have no dated gym membership on record.
- **Dates are the sheet's.** They are never worked out from the package length, unless staff
  choose "start + N months" for a flagged row. Blank dates stay blank.
- **Dues** lists only memberships that ended in the last 90 days (`DUES_LOOKBACK_DAYS`).
  - Otherwise every 2022 record would show as a "renewal due".
  - Older expiries are under Members → Inactive.
- **Door access** depends on the gym membership only. PT alone never gives gym entry.

## 6. Payments

- Each row becomes one payment: `source: "legacy_excel"`, `paymentType` "membership" or "pt",
  linked to its membership period or PT package. Several payments can link to one record.
- **No receipt number.** These weren't receipts issued by this system. They show as
  "Payment record — Imported", and the receipt counter isn't touched.
- **Method:** the sheet's Mode when it has one; otherwise "Not recorded". Staff can't pick
  "Not recorded" for new payments.
- Imported payments count in revenue on their real 2022 dates, and appear under Payments with a
  custom date range.

## 7. Importing twice is safe

- **Payment id:** each row's key is made from file + sheet + row, plus the row's own fields,
  e.g. `lx_7383283249_2026-09-01_r6_1orw0tvgsandi_p`. Rows can't collide: the Membership sheet
  has 105 distinct keys even though its Sr.No repeats.
- **Fingerprint:** member, payment date, type, months, dates and amount — without the file or
  row. It recognises the same payment in a renamed copy, a re-ordered sheet or a later month's
  file.
  - Payments from the first import (the Member details sheet) stored exactly this as their key,
    so they're recognised too.
- **Membership / PT records** of a dated period have ids built from phone + dates + package. A
  later instalment (even from another file) joins the same record.
- New members get the id `lx_<phone>`.
- **What that guarantees:**
  - Before importing, rows already in the system show "Already imported" and are left out.
  - Documents are only ever created, never overwritten, and the rules refuse to overwrite a
    payment.
  - An interrupted import can simply be run again. So can one where some rows were left for
    review: deciding them later imports just those rows.
- Each run is logged in `imports` with its counts and the sheet rows in each outcome. It's listed
  under "Earlier imports".
- **The report** after importing lists every sheet row: imported, already imported, left for
  review, or not imported (with the reason). It downloads as CSV.

## 8. Safety and rollback

- **Nothing is written until "Import …" is clicked.** Rows needing review stay out unless ticked.
- **Existing members, payments, receipts, plans and team profiles are never changed.**
- **Rollback:** every imported document is marked `source: "legacy_excel"` and has a `legacy.key`.
  - Payments can be voided with a reason, as with any payment.
  - Deleting imported records needs a one-off admin script (Firebase console or Admin SDK)
    filtering on `source == "legacy_excel"`. The app never deletes payments.

## 9. Production checklist

1. **Deploy** the code (merge to `main`) and wait for Vercel.
2. **Publish** `firestore.rules`. It adds the rules for `memberships`, `ptPackages`, `imports`
   and imported payments. It also lets imported membership records keep blank dates (day
   passes); new records still need dates.
3. **Rehearse on the emulator first:** `npm run test:events`, with the sheets copied to
   `tests/fixtures/member-details.xlsx` and `tests/fixtures/september-2026.xlsx`. The copies are
   git-ignored because they hold real names and phone numbers.
4. **In production, as an admin:** Members → Import → From the old member sheet → choose the file.
5. **Check the counts.**
   - Member details: 13 members, 11 membership records, 4 PT records, nothing to review.
   - Membership sheet: 105 rows, 94 people, 19 to review, 4 that can't be imported.
6. **Decide the review rows** with the owner (section 0). Anything undecided simply waits.
7. **Import**, then open two or three imported members and check their history and payments.
8. **Confirm with the owner:** what the blue and green colours meant, and whether any `bal`
   amounts are still owed. If they are, record them manually; the importer never creates dues.

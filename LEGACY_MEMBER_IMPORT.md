# Importing the old member sheet

This guide covers moving the gym's old spreadsheet ("Member details.xlsx") into the admin as
members, membership history, personal training (PT) packages and payments. It's written for
whoever runs the migration: the gym owner or an admin, plus a developer for the one-off steps.

Where it happens: **Admin → Members → Import → "From the old member sheet"**.

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

**One row needs a person to check it: row 8, Neha Goyal, PT.** It has Paid ₹5,000 and bal `9000`.
- If approved, the 9000 is stored as an unconfirmed old balance (`legacyBalanceAmountPaise`).
- It is never shown as a due.

**Exact duplicate rows:** none.

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
| bal | `legacyBalanceNote`, plus `legacyBalanceAmountPaise` only when it's a bare number |
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
- **No usable phone:** the row can't be imported (it can't be matched safely).
- Names alone never merge two people.

## 5. History stays history

- A new member's plan and dates come from their latest membership row.
- Active or expired status comes from those dates, so everyone in this sheet is **expired**.
- **People with only PT rows** (Vishal Varuka, Neha Goyal) are added as **inactive** members,
  with a note saying so. They have no gym membership on record.
- **Dues** lists only memberships that ended in the last 90 days (`DUES_LOOKBACK_DAYS`).
  - Otherwise every 2022 record would show as a "renewal due".
  - Older expiries are under Members → Inactive.
- **Door access** depends on the gym membership only. PT alone never gives gym entry.

## 6. Payments

- Each row becomes one payment: `source: "legacy_excel"`, `paymentType` "membership" or "pt",
  linked to its membership period or PT package.
- **No receipt number.** These weren't receipts issued by this system. They show as
  "Payment record — Imported", and the receipt counter isn't touched.
- **Method: "Not recorded".** The sheet doesn't say. Staff can't pick this method for new
  payments.
- Imported payments count in revenue on their real 2022 dates, and appear under Payments with a
  custom date range.

## 7. Importing twice is safe

- Every row has a deterministic key made from: phone, payment date, type, months, start, end
  and amount. It doesn't depend on the file name or row order.
- The payment, PT and membership documents use that key as their id, e.g.
  `lx_9881715183_2022-09-01_pt_1_2022-09-02_2022-10-02_800000_p`.
- New members get the id `lx_<phone>`.
- **What that guarantees:**
  - Before importing, rows that already exist show "Already imported" and are left out.
  - The rules refuse to overwrite an existing payment.
  - An interrupted import can simply be run again.
- Each run is logged in `imports` (counts only) and listed under "Earlier imports".

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
   and imported payments.
3. **Rehearse on the emulator first:** `npm run test:events`, with the sheet copied to
   `tests/fixtures/member-details.xlsx`. The copy is git-ignored because it holds real names
   and phone numbers.
4. **In production, as an admin:** Members → Import → From the old member sheet → choose the file.
5. **Check the counts:** 13 members, 11 membership records, 4 PT records, 1 needing review.
6. **Decide on row 8** (Neha Goyal, bal 9000). Tick it only if the owner confirms it.
7. **Import**, then open two or three imported members and check their history and payments.
8. **Confirm with the owner:** what the blue and green colours meant, and whether any `bal`
   amounts are still owed. If they are, record them manually; the importer never creates dues.

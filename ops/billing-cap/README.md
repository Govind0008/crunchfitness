# Billing cap (₹200 hard stop)

Keeps the Firebase project `crunch-fitness-blog` from ever being charged more than about ₹200 a month.

| Spend this month | What happens |
|---|---|
| ₹100, ₹180, ₹200 | Email alert to the billing account's admins |
| **₹150** | `billing-cap` function **unlinks billing** from the project |

After the cut-off the project is back on the free (Spark) daily limits: Firestore keeps working up to
the free quota (50,000 reads / 20,000 writes a day), and nothing more can be charged. To turn
billing back on: Firebase console → Usage and billing → Blaze (re-link the billing account).

Why ₹150 and not ₹200: Google reports costs to budgets a few hours late, so the margin absorbs
what is spent before the report arrives.

## Install (once, after switching to Blaze)
1. Open https://shell.cloud.google.com (signed in as the project owner).
2. Upload this folder (⋮ → Upload → folder `ops/billing-cap`), then:
   ```
   cd billing-cap && ./setup.sh
   ```
3. Run the safe ₹1 test the script prints. The log line shows `"cost":1 … "cap":150` and billing stays on.

## Files
- `index.js` — the function (Pub/Sub budget message → unlink billing when cost ≥ cap)
- `decide.js` — the cut-off rule; `node decide.test.js` checks it
- `setup.sh` — APIs, topic, least-privilege service account, function, budget

#!/usr/bin/env bash
# Hard ₹200 spending cap for the Firebase project — run ONCE in Google Cloud Shell after the
# project is on the Blaze plan. Safe to run again (each step skips what already exists).
#
#   ₹100 (50%), ₹180 (90%), ₹200 (100%) → email alerts to the billing admins
#   ₹150 spent                          → billing switched OFF (the project drops back to the free
#                                          limits; nothing more can be charged)
# The cut-off is ₹150, not ₹200, because Google reports costs a few hours late.
set -euo pipefail

PROJECT=crunch-fitness-blog
REGION=asia-south1
TOPIC=billing-cap
SA_NAME=billing-cap
SA="$SA_NAME@$PROJECT.iam.gserviceaccount.com"
BUDGET_INR=200
CAP_INR=150

gcloud config set project "$PROJECT" >/dev/null
BILLING=$(gcloud billing projects describe "$PROJECT" --format='value(billingAccountName)' | sed 's#billingAccounts/##')
if [ -z "$BILLING" ]; then echo "This project has no billing account yet: switch it to Blaze in the Firebase console first."; exit 1; fi
NUMBER=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')
echo "Project $PROJECT (#$NUMBER), billing account $BILLING"

echo "1/5 Turning on the APIs this needs…"
gcloud services enable cloudbilling.googleapis.com billingbudgets.googleapis.com pubsub.googleapis.com \
  cloudfunctions.googleapis.com run.googleapis.com cloudbuild.googleapis.com eventarc.googleapis.com artifactregistry.googleapis.com

echo "2/5 Message topic for the budget…"
gcloud pubsub topics describe "$TOPIC" >/dev/null 2>&1 || gcloud pubsub topics create "$TOPIC"

echo "3/5 A service account that may only unlink billing from this project…"
gcloud iam service-accounts describe "$SA" >/dev/null 2>&1 || gcloud iam service-accounts create "$SA_NAME" --display-name="Billing cap (switches billing off at ₹$CAP_INR)"
gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$SA" --role=roles/billing.projectManager --condition=None >/dev/null
gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$SA" --role=roles/run.invoker --condition=None >/dev/null
gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$SA" --role=roles/eventarc.eventReceiver --condition=None >/dev/null
# Pub/Sub may need to sign the push to the function (older projects)
gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:service-$NUMBER@gcp-sa-pubsub.iam.gserviceaccount.com" --role=roles/iam.serviceAccountTokenCreator --condition=None >/dev/null

echo "4/5 Deploying the cap function…"
gcloud functions deploy billing-cap --gen2 --runtime=nodejs20 --region="$REGION" --source=. --entry-point=capSpending \
  --trigger-topic="$TOPIC" --service-account="$SA" --trigger-service-account="$SA" \
  --set-env-vars="TARGET_PROJECT=$PROJECT,CAP_AMOUNT=$CAP_INR" --max-instances=1 --memory=256Mi --quiet

echo "5/5 The ₹$BUDGET_INR monthly budget (emails at 50/90/100%, cost reports to the function)…"
if gcloud billing budgets list --billing-account="$BILLING" --format='value(displayName)' | grep -qx "Crunch hard cap"; then
  echo "   budget already exists"
else
  gcloud billing budgets create --billing-account="$BILLING" --display-name="Crunch hard cap" \
    --budget-amount="${BUDGET_INR}INR" --filter-projects="projects/$PROJECT" --calendar-period=month \
    --threshold-rule=percent=0.5 --threshold-rule=percent=0.9 --threshold-rule=percent=1.0 \
    --notifications-rule-pubsub-topic="projects/$PROJECT/topics/$TOPIC"
fi

echo
echo "Done. Safe test (₹1 — does NOT switch billing off):"
echo "  gcloud pubsub topics publish $TOPIC --message='{\"costAmount\":1,\"budgetAmount\":$BUDGET_INR,\"currencyCode\":\"INR\"}'"
echo "  sleep 30; gcloud functions logs read billing-cap --region=$REGION --gen2 --limit=5"

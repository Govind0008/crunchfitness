// Hard spending cap for the crunch-fitness-blog Firebase project.
//
// A Cloud Billing budget publishes this month's cost to the Pub/Sub topic "billing-cap" several
// times a day. When the cost reaches CAP_AMOUNT (₹150 by default, under the ₹200 budget because
// Google reports costs a few hours late), this function unlinks the project from its billing
// account. The project then falls back to the free (Spark) daily limits — nothing more can be
// charged — until billing is linked again by hand in the Firebase console.
import functions from '@google-cloud/functions-framework';
import { GoogleAuth } from 'google-auth-library';
import { capFrom, shouldCut } from './decide.js';

const PROJECT = process.env.TARGET_PROJECT;
const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-billing'] });
const billingUrl = `https://cloudbilling.googleapis.com/v1/projects/${PROJECT}/billingInfo`;

functions.cloudEvent('capSpending', async (event) => {
  const raw = event.data?.message?.data;
  const message = raw ? JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) : {};
  const cap = capFrom(process.env);
  console.log(JSON.stringify({ cost: message.costAmount, budget: message.budgetAmount, currency: message.currencyCode, cap }));
  if (!shouldCut(message, cap)) return;

  const client = await auth.getClient();
  const { data: info } = await client.request({ url: billingUrl });
  if (!info.billingEnabled) { console.log('Billing is already off.'); return; }
  await client.request({ url: billingUrl, method: 'PUT', data: { billingAccountName: '' } });
  console.log(`Cost ${message.costAmount} ${message.currencyCode} reached the cap of ${cap}: billing switched OFF for ${PROJECT}.`);
});

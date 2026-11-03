// The cut-off decision, kept apart so it can be tested without Google Cloud.
// A budget message (Pub/Sub, JSON) carries costAmount = what this month has cost so far.

/** Spend (in the budget's currency) at which billing is switched off */
export const capFrom = (env) => {
  const n = Number(env.CAP_AMOUNT);
  return Number.isFinite(n) && n > 0 ? n : 150;
};

/** true when this month's cost has reached the cap */
export function shouldCut(message, cap) {
  const cost = Number(message?.costAmount);
  return Number.isFinite(cost) && cost >= cap;
}

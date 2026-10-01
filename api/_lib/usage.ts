// What the relay costs in Firestore operations, by cause — so the effect of throttling can be
// measured instead of estimated. Counted in memory per device serial and per server instance,
// then added to admsDiagnostics/{SN}.usage (and logged) whenever that record is written.
//
// A query is counted as max(1, documents returned): Firestore bills at least one read for every
// query, even an empty one. Reads made by security rules don't apply here (the Admin SDK bypasses
// rules).

export type UsageCause =
  | 'diagnostics'   // the per-device contact record
  | 'commands'      // looking for queued CRM commands, marking them sent
  | 'results'       // the device's answers to OUR commands
  | 'heartbeat'     // the device's lastSeenAt
  | 'deviceLookup'  // serial → CRM device id
  | 'punches'       // access events, attendance, member last visit (api/_lib/ingest.ts)
  | 'deviceUsers';  // the device's user list and fingerprint reports

export interface Meter { read: (cause: UsageCause, n?: number) => void; write: (cause: UsageCause, n?: number) => void }

const pending = new Map<string, Map<string, number>>();
export function meterFor(sn: string): Meter {
  const add = (op: 'reads' | 'writes', cause: UsageCause, n = 1) => {
    if (n <= 0) return;
    const m = pending.get(sn) ?? new Map<string, number>();
    m.set(`${op}.${cause}`, (m.get(`${op}.${cause}`) ?? 0) + n);
    pending.set(sn, m);
  };
  return { read: (c, n) => add('reads', c, n), write: (c, n) => add('writes', c, n) };
}
/** The counts gathered since the last call, for one serial (and forgets them). */
export function takeUsage(sn: string): Record<string, number> {
  const m = pending.get(sn);
  pending.delete(sn);
  return m ? Object.fromEntries(m) : {};
}
/** Put counts back if writing them failed, so nothing is lost. */
export function returnUsage(sn: string, usage: Record<string, number>) {
  const m = pending.get(sn) ?? new Map<string, number>();
  for (const [k, n] of Object.entries(usage)) m.set(k, (m.get(k) ?? 0) + n);
  pending.set(sn, m);
}
/** A no-op meter (backfill, tests). */
export const noMeter: Meter = { read: () => {}, write: () => {} };

// Gym-wide admin activity log (append-only; the rules forbid edits and deletes).
// Event-specific actions keep their own per-event log (events/{id}/activity).
import { collection, doc, getDocs, limit, orderBy, query, serverTimestamp, writeBatch, type Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface AdminActor { uid: string; email: string }
export interface ActivityEntry {
  id: string; action: string; actorUid: string; actorEmail: string;
  refType: string; refId: string | null; meta: Record<string, string | number | boolean | null>; at?: Timestamp;
}

type Batch = ReturnType<typeof writeBatch>;

/** Add a log entry to a batch so it commits atomically with the change it describes. */
export function logTo(b: Batch, actor: AdminActor, action: string, refType: string, refId: string | null, meta: ActivityEntry['meta'] = {}) {
  b.set(doc(collection(db, 'activity')), { action, actorUid: actor.uid, actorEmail: actor.email, refType, refId, meta, at: serverTimestamp() });
}

/** Stand-alone entry, for screens whose writes happen elsewhere (legacy dashboard forms). */
export async function logAdmin(actor: AdminActor | null, action: string, refType: string, refId: string | null, meta: ActivityEntry['meta'] = {}) {
  if (!actor) return;
  const b = writeBatch(db);
  logTo(b, actor, action, refType, refId, meta);
  await b.commit().catch(() => { /* logging must never block the action itself */ });
}

export async function recentActivity(n = 100): Promise<ActivityEntry[]> {
  const snap = await getDocs(query(collection(db, 'activity'), orderBy('at', 'desc'), limit(n)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ActivityEntry);
}

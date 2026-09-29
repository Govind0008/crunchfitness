// Access control records in Firestore (browser side). What staff can do here is limited to what
// they actually know: register a device, link a member to a device user ID, confirm a fingerprint
// was saved on the device, disable/remove, and block someone. Online status, sync results and
// scans are written only by the integration service (the rules refuse them from the browser).
import {
  collection, doc, getCountFromServer, getDocs, limit, orderBy, query, runTransaction, serverTimestamp, where,
  writeBatch, type DocumentData,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { GYM } from '@/lib/gym';
import { logTo, type AdminActor } from '@/lib/admin/activity';
import type { Member } from '@/lib/admin/members';
import { identityId, type AccessDevice, type AccessEvent, type AccessOverride, type BiometricIdentity, type BiometricStatus, type DeviceProtocol } from './index';

const gymId = GYM.id;
const devicesCol = () => collection(db, 'gyms', gymId, 'devices');
const idCol = () => collection(db, 'biometricIdentities');
const withId = <T,>(d: { id: string; data: () => DocumentData }) => ({ id: d.id, ...d.data() }) as T;

// ── Devices ──────────────────────────────────────────────────────────────────
export async function listDevices(): Promise<AccessDevice[]> {
  const snap = await getDocs(devicesCol());
  return snap.docs.map((d) => withId<AccessDevice>(d)).sort((a, b) => a.name.localeCompare(b.name));
}

export interface DeviceInput { name: string; model: string; serialNumber: string; location: string; protocol: DeviceProtocol }
export function validateDevice(i: DeviceInput): string[] {
  const e: string[] = [];
  if (i.name.trim().length < 2) e.push('Give the device a name, e.g. “Main entrance”.');
  if (!i.model.trim()) e.push('Add the device model, e.g. “eSSL F22”.');
  if (i.serialNumber && !/^[A-Za-z0-9-]{4,40}$/.test(i.serialNumber.trim())) e.push('The serial number should be letters and digits (from the device’s System Info screen).');
  return e;
}
export async function saveDevice(i: DeviceInput, actor: AdminActor, existing?: AccessDevice) {
  const b = writeBatch(db);
  const clean = { name: i.name.trim(), model: i.model.trim(), serialNumber: i.serialNumber.trim().toUpperCase(), location: i.location.trim(), protocol: i.protocol };
  if (existing) b.update(doc(devicesCol(), existing.id), { ...clean, updatedAt: serverTimestamp() });
  else b.set(doc(devicesCol()), { ...clean, gymId, enabled: true, nextUserId: 1, lastSeenAt: null, lastSyncAt: null, firmware: null, lastError: null, createdBy: actor.email, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  logTo(b, actor, existing ? 'Access device updated' : 'Access device added', 'device', existing?.id ?? null, { name: clean.name, model: clean.model });
  await b.commit();
}
export async function setDeviceEnabled(d: AccessDevice, enabled: boolean, actor: AdminActor) {
  const b = writeBatch(db);
  b.update(doc(devicesCol(), d.id), { enabled, updatedAt: serverTimestamp() });
  logTo(b, actor, enabled ? 'Access device enabled' : 'Access device disabled', 'device', d.id, { name: d.name });
  await b.commit();
}

// ── Member ↔ device user ─────────────────────────────────────────────────────
/** The device's own user list, as uploaded by the access reader on the gym PC (IDs and names only). */
export interface DeviceUserRow { id: string; deviceUserId: string; name: string; admin: boolean; hasCard: boolean }
export async function deviceUsersOf(deviceId: string): Promise<DeviceUserRow[]> {
  const snap = await getDocs(collection(db, 'gyms', gymId, 'devices', deviceId, 'deviceUsers'));
  return snap.docs.map((d) => withId<DeviceUserRow>(d));
}
export async function identitiesOfDevice(deviceId: string): Promise<BiometricIdentity[]> {
  const snap = await getDocs(query(idCol(), where('gymId', '==', gymId), where('deviceId', '==', deviceId)));
  return snap.docs.map((d) => withId<BiometricIdentity>(d));
}

export async function identitiesOfMember(memberId: string): Promise<BiometricIdentity[]> {
  // Every access query names the gym: the rules only allow reading your own gym's records
  const snap = await getDocs(query(idCol(), where('gymId', '==', gymId), where('memberId', '==', memberId)));
  return snap.docs.map((d) => withId<BiometricIdentity>(d));
}
export async function identitiesByStatus(statuses: BiometricStatus[], n = 500): Promise<BiometricIdentity[]> {
  const snap = await getDocs(query(idCol(), where('gymId', '==', gymId), where('status', 'in', statuses), limit(n)));
  return snap.docs.map((d) => withId<BiometricIdentity>(d));
}
export async function identityByDeviceUserId(deviceUserId: string): Promise<BiometricIdentity[]> {
  const snap = await getDocs(query(idCol(), where('gymId', '==', gymId), where('deviceUserId', '==', deviceUserId), limit(10)));
  return snap.docs.map((d) => withId<BiometricIdentity>(d));
}
export async function identitiesForMembers(memberIds: string[]): Promise<Map<string, BiometricIdentity[]>> {
  const out = new Map<string, BiometricIdentity[]>();
  const ids = [...new Set(memberIds)];
  for (let i = 0; i < ids.length; i += 30) {
    const snap = await getDocs(query(idCol(), where('gymId', '==', gymId), where('memberId', 'in', ids.slice(i, i + 30))));
    snap.docs.forEach((d) => { const x = withId<BiometricIdentity>(d); out.set(x.memberId, [...(out.get(x.memberId) ?? []), x]); });
  }
  return out;
}

export class DeviceUserTakenError extends Error {}

/**
 * Link a member to a device user ID on one device. Either the next free number (new enrolment) or
 * the ID the old CRM already gave them (members already on the F22 keep their ID). One transaction:
 * the ID can't be handed to two people. Status starts as PENDING — nothing is on the device yet
 * as far as this system knows.
 */
export async function assignDeviceUser(member: Pick<Member, 'id' | 'name'>, device: AccessDevice, actor: AdminActor, opts: { existingId?: string; method: BiometricIdentity['method'] }) {
  const deviceRef = doc(devicesCol(), device.id);
  return runTransaction(db, async (tx) => {
    const d = await tx.get(deviceRef);
    if (!d.exists()) throw new Error('That device no longer exists.');
    let userId = opts.existingId?.trim() ?? '';
    let next = (d.data().nextUserId as number) ?? 1;
    if (!userId) {
      // First free number from the device's counter (skips any IDs typed in by hand)
      for (let tries = 0; tries < 50; tries++) {
        const snap = await tx.get(doc(idCol(), identityId(device.id, String(next))));
        if (!snap.exists()) break;
        next++;
      }
      userId = String(next);
      next++;
    } else if (!/^[A-Za-z0-9_-]{1,24}$/.test(userId)) {
      throw new Error('Device user IDs are letters and digits only.');
    }
    const ref = doc(idCol(), identityId(device.id, userId));
    if ((await tx.get(ref)).exists()) throw new DeviceUserTakenError(`Device user ${userId} is already linked to someone on ${device.name}.`);
    tx.set(ref, {
      gymId, memberId: member.id, deviceId: device.id, deviceUserId: userId, method: opts.method, status: 'PENDING',
      enrolledAt: null, lastSyncedAt: null, lastSyncAttemptAt: null, lastSyncError: null,
      createdBy: actor.email, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    if (!opts.existingId) tx.update(deviceRef, { nextUserId: next });
    logTo(tx, actor, 'Biometric enrolment started', 'member', member.id, { name: member.name, device: device.name, deviceUserId: userId });
    return userId;
  });
}

/** Staff confirm what they saw on the device (fingerprint saved), or disable/remove the link. */
export async function setIdentityStatus(identity: BiometricIdentity, status: Extract<BiometricStatus, 'PENDING' | 'ENROLLED' | 'DISABLED' | 'REMOVED'>, actor: AdminActor, memberName: string) {
  const b = writeBatch(db);
  b.update(doc(idCol(), identity.id), { status, ...(status === 'ENROLLED' ? { enrolledAt: serverTimestamp() } : {}), updatedAt: serverTimestamp() });
  const action = { PENDING: 'Biometric enrolment restarted', ENROLLED: 'Fingerprint enrolled on device', DISABLED: 'Device access disabled', REMOVED: 'Removed from device' }[status];
  logTo(b, actor, action, 'member', identity.memberId, { name: memberName, deviceUserId: identity.deviceUserId });
  await b.commit();
}

// ── Staff block ───────────────────────────────────────────────────────────────
export async function setAccessOverride(m: Member, override: AccessOverride | null, reason: string, actor: AdminActor) {
  const b = writeBatch(db);
  b.update(doc(db, 'members', m.id), { accessOverride: override, accessOverrideReason: override ? reason.trim() : null, updatedAt: serverTimestamp() });
  logTo(b, actor, override ? (override === 'blocked' ? 'Access blocked' : 'Membership suspended') : 'Access restored', 'member', m.id, { name: m.name, reason: reason.trim() });
  await b.commit();
}
export async function blockedMembers(n = 200) {
  const snap = await getDocs(query(collection(db, 'members'), where('accessOverride', 'in', ['blocked', 'suspended']), limit(n)));
  return snap.docs.map((d) => withId<Member>(d));
}

// ── Scans (read-only here) ────────────────────────────────────────────────────
const evCol = () => collection(db, 'accessEvents');
export async function accessEventsSince(sinceIso: string, n = 100): Promise<AccessEvent[]> {
  const snap = await getDocs(query(evCol(), where('gymId', '==', gymId), where('at', '>=', sinceIso), orderBy('at', 'desc'), limit(n)));
  return snap.docs.map((d) => withId<AccessEvent>(d));
}
export async function accessEventsOfMember(memberId: string, n = 50): Promise<AccessEvent[]> {
  const snap = await getDocs(query(evCol(), where('gymId', '==', gymId), where('memberId', '==', memberId), orderBy('at', 'desc'), limit(n)));
  return snap.docs.map((d) => withId<AccessEvent>(d));
}

export interface AccessSummary {
  devices: AccessDevice[];
  scansToday: number;
  grantedToday: number;
  pending: number;
  failed: number;
  enrolled: number;
  blocked: number;
}
/** Everything on the dashboard's access card — counts only, nothing downloaded in bulk. */
export async function accessSummary(todayStartIso: string): Promise<AccessSummary> {
  const c = (q: ReturnType<typeof query>) => getCountFromServer(q).then((s) => s.data().count);
  const [devices, scansToday, grantedToday, pending, failed, enrolled, blocked] = await Promise.all([
    listDevices(),
    // Same sort as the scan list, so both use the one (gymId, at desc) index
    c(query(evCol(), where('gymId', '==', gymId), where('at', '>=', todayStartIso), orderBy('at', 'desc'))),
    c(query(evCol(), where('gymId', '==', gymId), where('result', '==', 'granted'), where('at', '>=', todayStartIso))),
    c(query(idCol(), where('gymId', '==', gymId), where('status', 'in', ['PENDING', 'SYNCING']))),
    c(query(idCol(), where('gymId', '==', gymId), where('status', '==', 'SYNC_FAILED'))),
    c(query(idCol(), where('gymId', '==', gymId), where('status', 'in', ['ENROLLED', 'SYNCED']))),
    c(query(collection(db, 'members'), where('accessOverride', 'in', ['blocked', 'suspended']))),
  ]);
  return { devices, scansToday, grantedToday, pending, failed, enrolled, blocked };
}

/** Midnight in the gym's timezone today, as an ISO instant (India has no DST: +05:30). */
export const todayStartIso = (today: string) => new Date(`${today}T00:00:00+05:30`).toISOString();

/** Users linked to one device, by state — counts only. */
export async function deviceCounts(deviceId: string) {
  const c = (statuses: BiometricStatus[]) => getCountFromServer(query(idCol(), where('gymId', '==', gymId), where('deviceId', '==', deviceId), where('status', 'in', statuses))).then((s) => s.data().count);
  const [enrolled, pending, errors] = await Promise.all([c(['ENROLLED', 'SYNCED']), c(['PENDING', 'SYNCING']), c(['SYNC_FAILED'])]);
  return { enrolled, pending, errors };
}

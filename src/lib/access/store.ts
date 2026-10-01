// Access control records in Firestore (browser side). What staff can do here is limited to what
// they actually know: register a device, link a member to a device user ID, confirm a fingerprint
// was saved on the device, disable/remove, and block someone. Online status, sync results and
// scans are written only by the integration service (the rules refuse them from the browser).
import {
  collection, doc, getCountFromServer, getDocs, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, setDoc, where,
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
/** The device's own user list, as reported by the device through the relay (IDs and names only). */
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
export async function identitiesOfTrainer(trainerId: string): Promise<BiometricIdentity[]> {
  const snap = await getDocs(query(idCol(), where('gymId', '==', gymId), where('trainerId', '==', trainerId)));
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
/**
 * Link a device user ID to one person — a member (their punches become gym attendance) or a
 * trainer (staff attendance). Always an explicit choice by staff; never inferred from a name.
 */
export async function assignDeviceUser(member: Pick<Member, 'id' | 'name'> & { personType?: 'member' | 'trainer' }, device: AccessDevice, actor: AdminActor, opts: { existingId?: string; method: BiometricIdentity['method'] }) {
  const trainer = member.personType === 'trainer';
  const deviceRef = doc(devicesCol(), device.id);
  return runTransaction(db, async (tx) => {
    const d = await tx.get(deviceRef);
    if (!d.exists()) throw new Error('That device no longer exists.');
    let userId = opts.existingId?.trim() ?? '';
    let next = (d.data().nextUserId as number) ?? 1;
    if (!userId) {
      // First free number from the device's counter (skips any IDs typed in by hand)
      // Skips IDs linked in the CRM and IDs already used on the device itself (its user list)
      for (let tries = 0; tries < 50; tries++) {
        const [linked, onDevice] = await Promise.all([
          tx.get(doc(idCol(), identityId(device.id, String(next)))),
          tx.get(doc(db, 'gyms', gymId, 'devices', device.id, 'deviceUsers', String(next))),
        ]);
        if (!linked.exists() && !onDevice.exists()) break;
        next++;
      }
      userId = String(next);
      next++;
    } else if (!/^[A-Za-z0-9_-]{1,24}$/.test(userId)) {
      throw new Error('Device user IDs are letters and digits only.');
    }
    const ref = doc(idCol(), identityId(device.id, userId));
    if ((await tx.get(ref)).exists()) throw new DeviceUserTakenError(`Device user ${userId} is already linked to someone on ${device.name}.`);
    // A new ID handed out by the CRM is the CRM's to control; an ID already on the device
    // belongs to the old system until staff explicitly take that person over
    const managedBy = opts.existingId ? 'legacy' : 'crm';
    tx.set(ref, {
      gymId, personType: trainer ? 'trainer' : 'member', memberId: trainer ? null : member.id, trainerId: trainer ? member.id : null,
      deviceId: device.id, deviceUserId: userId, method: opts.method, status: 'PENDING',
      managedBy, accessEnabled: true, enrollment: managedBy === 'crm' ? 'not_enrolled' : 'unverified',
      enrolledAt: null, lastSyncedAt: null, lastSyncAttemptAt: null, lastSyncError: null,
      createdBy: actor.email, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    if (!opts.existingId) tx.update(deviceRef, { nextUserId: next });
    logTo(tx, actor, trainer ? 'Trainer linked to device user' : 'Biometric enrolment started', trainer ? 'trainer' : 'member', member.id, { name: member.name, device: device.name, deviceUserId: userId });
    return userId;
  });
}

const personRef = (i: BiometricIdentity) => (i.personType === 'trainer' ? { refType: 'trainer', refId: i.trainerId ?? null } : { refType: 'member', refId: i.memberId });

/**
 * Ask the device to start fingerprint enrolment for a CRM-managed user (the device shows its
 * "place finger" screen). Only marks the request: "enrolled" comes from the device itself.
 * The rules refuse this for users the old system manages.
 */
export async function requestEnrollment(i: BiometricIdentity, actor: AdminActor, name: string, opts: { createUser?: boolean } = {}) {
  if (i.managedBy !== 'crm') throw new Error('This device user is managed by the old system — enrol them there.');
  const { refType, refId } = personRef(i);
  const ids: { add?: string; enroll: string } = { enroll: '' };
  if (opts.createUser) ids.add = await queueDeviceCommand(i.deviceId, { type: 'add_user', deviceUserId: i.deviceUserId, name, personType: refType as 'member' | 'trainer', personId: refId ?? undefined }, actor);
  ids.enroll = await queueDeviceCommand(i.deviceId, { type: 'enroll_fp', deviceUserId: i.deviceUserId, personType: refType as 'member' | 'trainer', personId: refId ?? undefined }, actor);
  const b = writeBatch(db);
  b.update(doc(idCol(), i.id), { enrollment: 'requested', enrollmentRequestedAt: serverTimestamp(), updatedAt: serverTimestamp() });
  logTo(b, actor, 'Fingerprint enrolment requested', refType, refId, { name, deviceUserId: i.deviceUserId, event: 'ENROLLMENT_REQUESTED' });
  await b.commit();
  return ids;
}

/** The CRM's access switch for a CRM-managed device user (recorded and checked on every scan). */
export async function setIdentityAccess(i: BiometricIdentity, enabled: boolean, actor: AdminActor, name: string) {
  if (i.managedBy !== 'crm') throw new Error('This device user is managed by the old system.');
  const { refType, refId } = personRef(i);
  const b = writeBatch(db);
  b.update(doc(idCol(), i.id), { accessEnabled: enabled, updatedAt: serverTimestamp() });
  logTo(b, actor, enabled ? 'Access turned on' : 'Access turned off', refType, refId, { name, deviceUserId: i.deviceUserId, event: enabled ? 'ACCESS_ENABLED' : 'ACCESS_DISABLED' });
  await b.commit();
}

/** Explicit migration: the new CRM takes over (or hands back) this person's access. */
export async function setManagedBy(i: BiometricIdentity, managedBy: 'crm' | 'legacy', actor: AdminActor, name: string) {
  const { refType, refId } = personRef(i);
  const b = writeBatch(db);
  b.update(doc(idCol(), i.id), { managedBy, updatedAt: serverTimestamp() });
  logTo(b, actor, managedBy === 'crm' ? 'Access taken over by the new CRM' : 'Access handed back to the old system', refType, refId, { name, deviceUserId: i.deviceUserId, event: managedBy === 'crm' ? 'MANAGED_BY_CRM' : 'MANAGED_BY_LEGACY' });
  await b.commit();
}

/** Staff confirm what they saw on the device (fingerprint saved), or disable/remove the link. */
export async function setIdentityStatus(identity: BiometricIdentity, status: Extract<BiometricStatus, 'PENDING' | 'ENROLLED' | 'DISABLED' | 'REMOVED'>, actor: AdminActor, memberName: string) {
  const b = writeBatch(db);
  b.update(doc(idCol(), identity.id), { status, ...(status === 'ENROLLED' ? { enrolledAt: serverTimestamp() } : {}), updatedAt: serverTimestamp() });
  const action = { PENDING: 'Biometric enrolment restarted', ENROLLED: 'Fingerprint enrolled on device', DISABLED: 'Device access disabled', REMOVED: 'Removed from device' }[status];
  const trainer = identity.personType === 'trainer';
  logTo(b, actor, action, trainer ? 'trainer' : 'member', trainer ? identity.trainerId ?? null : identity.memberId, { name: memberName, deviceUserId: identity.deviceUserId });

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
export type ActivityWho = 'all' | 'member' | 'trainer' | 'unknown';
/**
 * The access activity list's query (paged with usePaged). Each filter maps to one composite index:
 * gymId + at · gymId + personType + at · gymId + memberId + at — all newest first.
 */
export function accessEventsQuery(f: { who: ActivityWho; memberId?: string; day?: string }) {
  const parts = [where('gymId', '==', gymId)];
  if (f.memberId) parts.push(where('memberId', '==', f.memberId));
  else if (f.who !== 'all') parts.push(where('personType', '==', f.who));
  if (f.day) {
    parts.push(where('at', '>=', todayStartIso(f.day)));
    parts.push(where('at', '<', new Date(Date.parse(todayStartIso(f.day)) + 86_400_000).toISOString()));
  }
  return query(evCol(), ...parts, orderBy('at', 'desc'));
}
export const toAccessEvent = (d: { id: string; data: () => DocumentData }) => withId<AccessEvent>(d);

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
  /** Punches today not linked to a member or trainer (null if that count couldn't be read) */
  unresolvedToday: number | null;
  /** Scans today by CRM-managed people whose access isn't allowed (the device still opened) */
  deniedToday: number | null;
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
  // Its own index (gymId + personType + at): if that isn't published yet, the rest still shows
  const unresolvedToday = await c(query(evCol(), where('gymId', '==', gymId), where('personType', '==', 'unknown'), where('at', '>=', todayStartIso), orderBy('at', 'desc'))).catch(() => null);
  const deniedToday = await c(query(evCol(), where('gymId', '==', gymId), where('result', '==', 'denied'), where('at', '>=', todayStartIso), orderBy('at', 'desc'))).catch(() => null);
  return { devices, scansToday, grantedToday, pending, failed, enrolled, blocked, unresolvedToday, deniedToday };
}

/** Midnight in the gym's timezone today, as an ISO instant (India has no DST: +05:30). */
export const todayStartIso = (today: string) => new Date(`${today}T00:00:00+05:30`).toISOString();

/** Users linked to one device, by state — counts only. */
export async function deviceCounts(deviceId: string) {
  const c = (statuses: BiometricStatus[]) => getCountFromServer(query(idCol(), where('gymId', '==', gymId), where('deviceId', '==', deviceId), where('status', 'in', statuses))).then((s) => s.data().count);
  const [enrolled, pending, errors] = await Promise.all([c(['ENROLLED', 'SYNCED']), c(['PENDING', 'SYNCING']), c(['SYNC_FAILED'])]);
  return { enrolled, pending, errors };
}

// ── Requests to the device (sent through the relay on its next poll, every few seconds) ──
export type DeviceCommandType = 'query_users' | 'add_user' | 'enroll_fp' | 'unlock_door';
export interface DeviceCommand {
  id: string; type: DeviceCommandType; deviceUserId?: string; name?: string; personType?: 'member' | 'trainer'; personId?: string;
  status: 'queued' | 'sent' | 'done' | 'failed'; returnCode?: string; error?: string;
  createdAt?: { toMillis: () => number }; sentAt?: { toMillis: () => number }; doneAt?: { toMillis: () => number };
}
const commandsCol = (deviceId: string) => collection(db, 'gyms', gymId, 'devices', deviceId, 'commands');
export async function queueDeviceCommand(deviceId: string, c: { type: DeviceCommandType; deviceUserId?: string; name?: string; personType?: 'member' | 'trainer'; personId?: string }, actor: AdminActor) {
  const ref = doc(commandsCol(deviceId));
  await setDoc(ref, {
    type: c.type, ...(c.deviceUserId ? { deviceUserId: c.deviceUserId } : {}), ...(c.name ? { name: c.name.slice(0, 40) } : {}),
    ...(c.personType && c.personId ? { personType: c.personType, personId: c.personId } : {}),
    status: 'queued', createdBy: actor.email, createdAt: serverTimestamp(),
  });
  return ref.id;
}
/**
 * Release the door now (ADMS AC_UNLOCK). Queued with its audit entry in one write. The relay sends
 * it on the device's next poll, and only the device's own answer says it worked; a request the
 * device doesn't collect within 30 seconds expires unsent (it never fires later).
 */
export async function openDoor(deviceId: string, actor: AdminActor) {
  const ref = doc(commandsCol(deviceId));
  const b = writeBatch(db);
  b.set(ref, { type: 'unlock_door', status: 'queued', createdBy: actor.email, createdAt: serverTimestamp() });
  logTo(b, actor, 'Door release requested', 'device', deviceId, { event: 'DOOR_UNLOCK_REQUESTED' });
  await b.commit();
  return ref.id;
}
/** Ask the device for its full user list (read-only on the device). */
export const syncDeviceUsers = (deviceId: string, actor: AdminActor) => queueDeviceCommand(deviceId, { type: 'query_users' }, actor);
/** The latest requests to a device, with what the device answered. */
export async function recentCommands(deviceId: string, n = 8): Promise<DeviceCommand[]> {
  const snap = await getDocs(query(commandsCol(deviceId), orderBy('createdAt', 'desc'), limit(n)));
  return snap.docs.map((d) => withId<DeviceCommand>(d));
}
/** Users on the device vs. linked in the CRM, by who controls them — counts only. */
export async function deviceUserCounts(deviceId: string) {
  const c = (q: ReturnType<typeof query>) => getCountFromServer(q).then((s) => s.data().count);
  const linked = (m: 'crm') => query(idCol(), where('gymId', '==', gymId), where('deviceId', '==', deviceId), where('managedBy', '==', m), where('status', 'in', ['PENDING', 'ENROLLED', 'SYNCED', 'SYNC_FAILED', 'DISABLED']));
  const [onDevice, allLinked, crm] = await Promise.all([
    c(query(collection(db, 'gyms', gymId, 'devices', deviceId, 'deviceUsers'))),
    c(query(idCol(), where('gymId', '==', gymId), where('deviceId', '==', deviceId), where('status', 'in', ['PENDING', 'ENROLLED', 'SYNCED', 'SYNC_FAILED', 'DISABLED']))),
    c(linked('crm')),
  ]);
  return { onDevice, crm, legacyLinked: allLinked - crm, notLinked: Math.max(0, onDevice - allLinked) };
}
/** Live status of one request (queued → sent → done / failed). */
export function watchDeviceCommand(deviceId: string, commandId: string, cb: (c: DeviceCommand | null) => void) {
  return onSnapshot(doc(commandsCol(deviceId), commandId), (s) => cb(s.exists() ? ({ id: s.id, ...s.data() } as DeviceCommand) : null), () => cb(null));
}
/** Live identity (so the enrolment screen can show "fingerprint saved" when the device reports it). */
export function watchIdentity(id: string, cb: (i: BiometricIdentity | null) => void) {
  return onSnapshot(doc(idCol(), id), (s) => cb(s.exists() ? withId<BiometricIdentity>(s) : null), () => cb(null));
}

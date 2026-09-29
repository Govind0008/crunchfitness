// Access control — the domain model for gym entry, independent of any device vendor.
//
//   Member ─→ Access eligibility (membership rules, below) ─→ Biometric identity (member ↔ device user)
//          ─→ Device enrolment ─→ Device (e.g. eSSL F22) ─→ Access events (scans) / attendance
//
// Honesty rules:
// - Nothing here talks to hardware. A device is only "online" / a member only "synced" when the
//   integration service (server side) has actually recorded it. The browser never writes those.
// - Eligibility comes from the gym MEMBERSHIP only. Personal training alone never grants entry.
// - The browser never holds device credentials.
import type { Member } from '@/lib/admin/members';

// ── Eligibility ───────────────────────────────────────────────────────────────
/** Staff can stop someone's access regardless of membership (e.g. conduct, unpaid, paused). */
export type AccessOverride = 'blocked' | 'suspended';
export const OVERRIDE_LABEL: Record<AccessOverride, string> = { blocked: 'Blocked by staff', suspended: 'Membership suspended' };

export type AccessEligibility =
  | { eligible: true; reason: string; until: string }
  | { eligible: false; reason: string }
  | { eligible: null; reason: string };

export interface EligibilityInput extends Pick<Member, 'status' | 'membershipEnd'> {
  accessOverride?: AccessOverride | null;
  accessOverrideReason?: string | null;
}

/**
 * Whether this person may enter the gym today. Order matters: a staff block always wins, then
 * the membership. Unknown (no expiry on record) is never treated as allowed.
 * PT packages are deliberately not an input — PT without a membership doesn't open the door.
 */
export function accessEligibility(m: EligibilityInput, today: string): AccessEligibility {
  if (m.accessOverride) return { eligible: false, reason: `${OVERRIDE_LABEL[m.accessOverride]}${m.accessOverrideReason ? ` — ${m.accessOverrideReason}` : ''}` };
  if (m.status === 'inactive') return { eligible: false, reason: 'Membership marked inactive' };
  if (!m.membershipEnd) return { eligible: null, reason: 'No gym membership on record' };
  if (m.membershipEnd < today) return { eligible: false, reason: `Membership expired on ${m.membershipEnd}` };
  return { eligible: true, reason: 'Active membership', until: m.membershipEnd };
}

// ── Biometric identity (a member as a user on one device) ────────────────────
/**
 * Lifecycle. Staff can move PENDING → ENROLLED (they saw the fingerprint saved on the device) and
 * to DISABLED / REMOVED. SYNCING, SYNCED and SYNC_FAILED are written only by the integration
 * service when the device confirms — the rules refuse them from the browser.
 */
export type BiometricStatus = 'NOT_ENROLLED' | 'PENDING' | 'ENROLLED' | 'SYNCING' | 'SYNCED' | 'SYNC_FAILED' | 'DISABLED' | 'REMOVED' | 'UNKNOWN';
export const BIOMETRIC_LABEL: Record<BiometricStatus, string> = {
  NOT_ENROLLED: 'Not enrolled', PENDING: 'Waiting for the device', ENROLLED: 'Enrolled on device (confirmed by staff)',
  SYNCING: 'Syncing', SYNCED: 'Synced with device', SYNC_FAILED: 'Sync failed', DISABLED: 'Access disabled on device',
  REMOVED: 'Removed from device', UNKNOWN: 'Unknown',
};
export const STAFF_SETTABLE: BiometricStatus[] = ['PENDING', 'ENROLLED', 'DISABLED', 'REMOVED'];

export interface BiometricIdentity {
  id: string;                 // `${deviceId}_${deviceUserId}` — one person per device user ID
  gymId: string;
  memberId: string;
  deviceId: string;
  deviceUserId: string;       // the ID typed/shown on the device (e.g. "1042")
  method: 'fingerprint' | 'face' | 'card' | 'unknown';
  status: BiometricStatus;
  enrolledAt?: { toDate: () => Date } | null;
  lastSyncedAt?: { toDate: () => Date } | null;
  lastSyncAttemptAt?: { toDate: () => Date } | null;
  lastSyncError?: string | null;
  createdBy: string;
}
export const identityId = (deviceId: string, deviceUserId: string) => `${deviceId}_${deviceUserId}`;

// ── Devices ──────────────────────────────────────────────────────────────────
export type DeviceProtocol = 'adms' | 'sdk' | 'other';
export const PROTOCOL_LABEL: Record<DeviceProtocol, string> = { adms: 'ADMS (push over HTTP)', sdk: 'Vendor SDK (LAN)', other: 'Other / not decided' };

/** Stored at gyms/{gymId}/devices/{deviceId}. No secrets: credentials live with the integration service. */
export interface AccessDevice {
  id: string;
  gymId: string;
  name: string;               // "Main entrance"
  model: string;              // "eSSL F22"
  serialNumber: string;
  location: string;
  protocol: DeviceProtocol;
  enabled: boolean;
  /** Written by the integration service only */
  lastSeenAt?: { toDate: () => Date } | null;
  lastSyncAt?: { toDate: () => Date } | null;
  firmware?: string | null;
  lastError?: string | null;
  /** Next device user ID to hand out (keeps IDs unique per device) */
  nextUserId: number;
}
/** Online = the integration service heard from it recently. Never assumed. */
export const ONLINE_WINDOW_MS = 10 * 60 * 1000;
export type DeviceHealth = 'online' | 'offline' | 'never_connected' | 'disabled';
export function deviceHealth(d: Pick<AccessDevice, 'enabled' | 'lastSeenAt'>, now = Date.now()): DeviceHealth {
  if (!d.enabled) return 'disabled';
  if (!d.lastSeenAt) return 'never_connected';
  return now - d.lastSeenAt.toDate().getTime() <= ONLINE_WINDOW_MS ? 'online' : 'offline';
}
export const HEALTH_LABEL: Record<DeviceHealth, string> = { online: 'Online', offline: 'Offline', never_connected: 'Waiting for first contact', disabled: 'Disabled' };

// ── Access events (scans) ─────────────────────────────────────────────────────
export type AccessResult = 'granted' | 'denied' | 'unknown_user' | 'access_disabled' | 'device_error';
export const RESULT_LABEL: Record<AccessResult, string> = {
  granted: 'Verified', denied: 'Denied', unknown_user: 'Unknown user', access_disabled: 'Access disabled', device_error: 'Device error',
};
export type VerifyMethod = 'fingerprint' | 'face' | 'card' | 'password' | 'unknown';

/** A scan as the device reported it, before we match it to anyone. */
export interface RawDeviceEvent {
  gymId: string;
  deviceId: string;
  deviceUserId: string;
  /** Local wall-clock time as the device recorded it, "YYYY-MM-DD HH:mm:ss" (device timezone) */
  deviceTime: string;
  verify: VerifyMethod;
  /** Device-reported status code, kept as-is */
  statusCode: string;
}

/** Stored at accessEvents/{key} by the integration service. */
export interface AccessEvent {
  id: string;
  gymId: string;
  deviceId: string;
  deviceUserId: string;
  memberId: string | null;
  /** ISO instant (converted using the gym's timezone) */
  at: string;
  verify: VerifyMethod;
  result: AccessResult;
  reason: string;
  statusCode: string;
  receivedAt?: { toDate: () => Date };
}

/**
 * Stable key for one scan: the same scan reported twice (device retry, replay, two listeners
 * during the pilot) maps to the same id, so it's stored once.
 */
export function deviceEventKey(e: Pick<RawDeviceEvent, 'gymId' | 'deviceId' | 'deviceUserId' | 'deviceTime'>) {
  if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(e.deviceTime.trim())) throw new Error('Invalid device timestamp');
  return [e.gymId, e.deviceId, e.deviceUserId, e.deviceTime.trim().replace(' ', 'T')].map((p) => p.replace(/[^A-Za-z0-9:._-]/g, '_')).join('__');
}

/** Device local time → ISO instant, for a gym in a fixed-offset zone (India: +05:30, no DST). */
export function deviceTimeToIso(deviceTime: string, offset = '+05:30') {
  const t = deviceTime.trim().replace(' ', 'T');
  const iso = new Date(`${t.length === 16 ? `${t}:00` : t}${offset}`);
  if (Number.isNaN(iso.getTime())) throw new Error('Invalid device timestamp');
  return iso.toISOString();
}

/**
 * Turn a raw scan into an access event: who it was (by the device user ID), and whether the
 * membership allowed entry at that moment. Pure — the integration service stores the result.
 */
export function processAttendanceEvent(
  raw: RawDeviceEvent,
  identity: Pick<BiometricIdentity, 'memberId' | 'status'> | null,
  member: EligibilityInput | null,
  today: string,
): Omit<AccessEvent, 'id' | 'receivedAt'> {
  const base = { gymId: raw.gymId, deviceId: raw.deviceId, deviceUserId: raw.deviceUserId, at: deviceTimeToIso(raw.deviceTime), verify: raw.verify, statusCode: raw.statusCode };
  if (!identity || !member) return { ...base, memberId: null, result: 'unknown_user', reason: `Device user ${raw.deviceUserId} isn’t linked to a member` };
  if (identity.status === 'DISABLED' || identity.status === 'REMOVED') return { ...base, memberId: identity.memberId, result: 'access_disabled', reason: 'Access disabled for this device user' };
  const e = accessEligibility(member, today);
  return e.eligible
    ? { ...base, memberId: identity.memberId, result: 'granted', reason: e.reason }
    : { ...base, memberId: identity.memberId, result: 'denied', reason: e.reason };
}

// ── Provider (vendor integration) ─────────────────────────────────────────────
export interface DeviceUser { deviceUserId: string; name?: string; enrolled: boolean }
export interface ProviderHealth { ok: boolean; message: string }

/**
 * What a vendor integration implements (eSSL F22 over ADMS is the first candidate). It runs in
 * the integration service — server side, near the device — never in this browser app.
 */
export interface AccessControlProvider {
  readonly name: string;
  registerDevice(device: Pick<AccessDevice, 'id' | 'serialNumber' | 'protocol'>): Promise<void>;
  getDeviceStatus(deviceId: string): Promise<{ health: DeviceHealth; firmware?: string | null; lastError?: string | null }>;
  enrollMember(deviceId: string, deviceUserId: string, name: string): Promise<BiometricStatus>;
  disableMemberAccess(deviceId: string, deviceUserId: string): Promise<BiometricStatus>;
  enableMemberAccess(deviceId: string, deviceUserId: string): Promise<BiometricStatus>;
  removeMember(deviceId: string, deviceUserId: string): Promise<BiometricStatus>;
  syncMember(deviceId: string, deviceUserId: string, eligibility: AccessEligibility): Promise<BiometricStatus>;
  processAttendanceEvent(raw: RawDeviceEvent): Promise<{ stored: boolean; key: string }>;
  getDeviceUsers(deviceId: string): Promise<DeviceUser[]>;
  healthCheck(): Promise<ProviderHealth>;
}

export class IntegrationNotConfiguredError extends Error {
  constructor() { super('Device integration not configured'); }
}

/** The provider the admin uses today: every device action says plainly that it isn't set up. */
export class NotConfiguredProvider implements AccessControlProvider {
  readonly name = 'Not configured';
  private no = async (): Promise<never> => { throw new IntegrationNotConfiguredError(); };
  registerDevice = this.no;
  getDeviceStatus = this.no;
  enrollMember = this.no;
  disableMemberAccess = this.no;
  enableMemberAccess = this.no;
  removeMember = this.no;
  syncMember = this.no;
  processAttendanceEvent = this.no;
  getDeviceUsers = this.no;
  async healthCheck(): Promise<ProviderHealth> { return { ok: false, message: 'Device integration not configured' }; }
}

/** Whether a real integration service is connected. Stays false until the F22 pilot is set up. */
export const ACCESS_CONNECTED = false;
export const accessProvider: AccessControlProvider = new NotConfiguredProvider();

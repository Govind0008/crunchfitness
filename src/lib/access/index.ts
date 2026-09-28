// Access control (biometric door) — the shape of the integration, NOT an integration.
//
// No device is connected. The manufacturer, model and protocol are not confirmed, so there is no
// device API here and nothing below talks to hardware. The layers are kept separate:
//
//   Membership (members, payments)  →  Access eligibility (this file, pure)
//     →  Access integration service (server side, future)  →  Local gym connector (LAN, future)
//     →  Biometric device
//
// The browser never talks to the device and never holds device credentials. Membership and
// payments work exactly the same whether or not a device is ever connected.
import type { Member } from '@/lib/admin/members';

/** Whether the membership entitles someone to enter — decided from membership data only. */
export type AccessEligibility =
  | { eligible: true; reason: string; until: string }
  | { eligible: false; reason: string }
  | { eligible: null; reason: string };

export function accessEligibility(m: Pick<Member, 'status' | 'membershipEnd'>, today: string): AccessEligibility {
  if (m.status === 'inactive') return { eligible: false, reason: 'Membership marked inactive' };
  if (!m.membershipEnd) return { eligible: null, reason: 'No expiry date on record' };
  if (m.membershipEnd < today) return { eligible: false, reason: `Membership expired on ${m.membershipEnd}` };
  return { eligible: true, reason: 'Active membership', until: m.membershipEnd };
}

/** The device side, tracked separately from membership. */
export type AccessStatus = 'ACCESS_ACTIVE' | 'ACCESS_DISABLED' | 'ACCESS_PENDING_SYNC' | 'ACCESS_SYNC_FAILED' | 'ACCESS_UNKNOWN';

export interface MemberAccessState {
  memberId: string;
  /** Stable identifier the device knows the member by (enrolment id) — never the name */
  deviceMemberId: string | null;
  status: AccessStatus;
  lastSyncedAt: string | null;
  lastError: string | null;
}

/** Non-secret device configuration. Credentials live only in the server-side connector's environment. */
export interface AccessDeviceConfig {
  provider: string;
  deviceId: string;
  model: string;
  connectionType: 'lan_connector' | 'cloud_api';
  /** Where the connector reaches the device, e.g. a LAN address — never a password or key */
  endpoint: string;
  connectorStatus: 'online' | 'offline' | 'unknown';
  lastSuccessfulSync: string | null;
  lastError: string | null;
}

/** A raw punch from the device, as the connector will report it. */
export interface DeviceAttendanceEvent {
  gymId: string;
  deviceId: string;
  deviceMemberId: string;
  /** ISO-8601 with offset, as recorded by the device */
  timestamp: string;
  type: 'entry' | 'exit' | 'denied';
}

/**
 * Idempotency key for a device punch: the same punch reported twice (connector retry, replay)
 * maps to the same document id, so it can only ever be stored once.
 */
export function deviceEventKey(e: DeviceAttendanceEvent) {
  const t = new Date(e.timestamp);
  if (Number.isNaN(t.getTime())) throw new Error('Invalid device timestamp');
  return [e.gymId, e.deviceId, e.deviceMemberId, e.type, t.toISOString()].map((p) => p.replace(/[^A-Za-z0-9:._-]/g, '_')).join('__');
}

/**
 * What a concrete provider (the connector for the confirmed device) will implement.
 * Implementations run server side — never in this browser app.
 */
export interface AccessControlProvider {
  readonly name: string;
  provisionMember(memberId: string, until: string): Promise<MemberAccessState>;
  updateMember(memberId: string, until: string): Promise<MemberAccessState>;
  disableMember(memberId: string): Promise<MemberAccessState>;
  removeMember(memberId: string): Promise<void>;
  getMemberStatus(memberId: string): Promise<MemberAccessState>;
  syncMember(memberId: string, eligibility: AccessEligibility): Promise<MemberAccessState>;
  getDeviceStatus(): Promise<Pick<AccessDeviceConfig, 'connectorStatus' | 'lastSuccessfulSync' | 'lastError'>>;
  receiveAttendanceEvent(e: DeviceAttendanceEvent): Promise<{ stored: boolean; key: string }>;
}

/** What the admin shows today: honest "not connected" until a real provider exists. */
export const ACCESS_CONNECTED = false;

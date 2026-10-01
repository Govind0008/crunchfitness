// Who controls a device user's access, and what the new CRM decides about a scan. Pure rules.
//
// During the migration the X2008 holds users from BOTH systems. A device user is controlled by
// the new CRM only when its identity record says so explicitly (managedBy: 'crm' — set when the
// CRM itself created the user on the device, or when staff explicitly take a person over).
// Everyone else is the old system's responsibility, and the new CRM never judges or changes them:
//
//   no identity                  → UNKNOWN_USER   (recorded; never a denial)
//   identity, managedBy ≠ 'crm'  → LEGACY_USER    (recorded, attendance kept; never a denial)
//   identity, managedBy = 'crm'  → ACCESS_ALLOWED | ACCESS_DENIED (+ reason code)
//
// IMPORTANT: the X2008 matches fingerprints and opens the door itself, BEFORE it uploads the scan
// (ADMS is a push protocol). So this decision is the CRM's verdict and audit trail — it cannot
// stop a door that has already opened. Physical blocking needs a device-side change; see
// ACCESS_CONTROL.md.

export type ManagedBy = 'crm' | 'legacy';
export type Decision = 'ACCESS_ALLOWED' | 'ACCESS_DENIED' | 'LEGACY_USER' | 'UNKNOWN_USER';
export type DenyReason =
  | 'MEMBERSHIP_EXPIRED' | 'MEMBERSHIP_INACTIVE' | 'MEMBERSHIP_NOT_STARTED' | 'NO_VALID_MEMBERSHIP' | 'PT_ONLY'
  | 'MEMBER_BLOCKED' | 'MEMBER_SUSPENDED' | 'ACCESS_DISABLED' | 'BIOMETRIC_NOT_LINKED';

export const DENY_TEXT: Record<DenyReason, string> = {
  MEMBERSHIP_EXPIRED: 'Membership expired', MEMBERSHIP_INACTIVE: 'Membership marked inactive', MEMBERSHIP_NOT_STARTED: 'Membership hasn’t started yet',
  NO_VALID_MEMBERSHIP: 'No gym membership on record', PT_ONLY: 'Personal training only — PT doesn’t include gym entry',
  MEMBER_BLOCKED: 'Blocked by staff', MEMBER_SUSPENDED: 'Membership suspended', ACCESS_DISABLED: 'Access turned off in the CRM',
  BIOMETRIC_NOT_LINKED: 'Device user isn’t linked to anyone in the CRM',
};

export interface IdentityLike { managedBy?: string | null; accessEnabled?: boolean | null; status?: string | null }
export interface MemberAccessLike {
  status?: string; membershipStart?: string | null; membershipEnd?: string | null;
  accessOverride?: string | null; accessOverrideReason?: string | null;
}

/** Only an explicit 'crm' marker hands control to the new CRM. Missing/anything else = legacy. */
export const isCrmManaged = (i: IdentityLike | null | undefined) => !!i && i.managedBy === 'crm';

/**
 * A member's gym-entry decision for one local day. Order: staff block, CRM access switch, then the
 * membership itself. PT never grants entry; no membership on record is never "allowed".
 * `hasPt` is only consulted to explain a denial (PT_ONLY vs NO_VALID_MEMBERSHIP).
 */
export function memberDecision(identity: IdentityLike | null, m: MemberAccessLike | null, day: string, hasPt = false): { decision: Decision; reason: DenyReason | null } {
  if (!identity) return { decision: 'UNKNOWN_USER', reason: null };
  if (!isCrmManaged(identity)) return { decision: 'LEGACY_USER', reason: null };
  if (!m) return { decision: 'ACCESS_DENIED', reason: 'BIOMETRIC_NOT_LINKED' };
  if (m.accessOverride === 'blocked') return { decision: 'ACCESS_DENIED', reason: 'MEMBER_BLOCKED' };
  if (m.accessOverride === 'suspended') return { decision: 'ACCESS_DENIED', reason: 'MEMBER_SUSPENDED' };
  if (identity.accessEnabled === false || identity.status === 'DISABLED') return { decision: 'ACCESS_DENIED', reason: 'ACCESS_DISABLED' };
  if (m.status === 'inactive') return { decision: 'ACCESS_DENIED', reason: 'MEMBERSHIP_INACTIVE' };
  if (!m.membershipEnd) return { decision: 'ACCESS_DENIED', reason: hasPt ? 'PT_ONLY' : 'NO_VALID_MEMBERSHIP' };
  if (m.membershipStart && m.membershipStart > day) return { decision: 'ACCESS_DENIED', reason: 'MEMBERSHIP_NOT_STARTED' };
  if (m.membershipEnd < day) return { decision: 'ACCESS_DENIED', reason: 'MEMBERSHIP_EXPIRED' };
  return { decision: 'ACCESS_ALLOWED', reason: null };
}

/** A trainer: staff, so no membership — only the CRM access switch applies (when CRM-managed). */
export function trainerDecision(identity: IdentityLike | null, trainerExists: boolean): { decision: Decision; reason: DenyReason | null } {
  if (!identity) return { decision: 'UNKNOWN_USER', reason: null };
  if (!isCrmManaged(identity)) return { decision: 'LEGACY_USER', reason: null };
  if (!trainerExists) return { decision: 'ACCESS_DENIED', reason: 'BIOMETRIC_NOT_LINKED' };
  if (identity.accessEnabled === false || identity.status === 'DISABLED') return { decision: 'ACCESS_DENIED', reason: 'ACCESS_DISABLED' };
  return { decision: 'ACCESS_ALLOWED', reason: null };
}

/** The legacy `result` field kept on access events for existing screens and indexes. */
export const resultOf = (d: Decision) => (d === 'ACCESS_ALLOWED' ? 'granted' : d === 'ACCESS_DENIED' ? 'denied' : d === 'LEGACY_USER' ? 'legacy' : 'unknown_user');

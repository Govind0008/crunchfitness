// Access control ON the device, for CRM-managed users only (see ACCESS_CONTROL.md §6).
//
// The X2008 opens the door itself when it recognises a finger, so the CRM's verdict on a scan
// can't stop it. Instead the CRM keeps each CRM-managed user's device record in the right state
// in advance: a user who isn't allowed in (membership expired, blocked, access switched off…) is
// put in a personal access time zone with no allowed hours; allowed again, they go back to the
// group's time zone. The fingerprint stays on the device, so a renewal needs no re-enrolment.
//
// Old-system users (managedBy ≠ 'crm') are never touched. ADMS_ENFORCE_ACCESS:
//   "off" (default) — nothing;  "dry" — work out and record what WOULD change, send nothing;
//   "on" — queue the block / unblock commands.
import { memberDecision, trainerDecision, type DenyReason, type IdentityLike, type MemberAccessLike } from './access.js';

export type DeviceAccess = 'open' | 'blocked';
export const ENFORCE_MODE = () => {
  const v = (process.env.ADMS_ENFORCE_ACCESS ?? 'off').toLowerCase();
  return v === 'on' || v === 'dry' ? v : 'off';
};
/** Every CRM-managed user, at most this often (catches memberships that expired overnight) */
export const ENFORCE_FULL_MS = () => Number(process.env.ADMS_ENFORCE_FULL_MS ?? 3_600_000);
/** Members and links changed since the last look (a renewal opens the door within about 5 minutes) */
export const ENFORCE_QUICK_MS = () => Number(process.env.ADMS_ENFORCE_QUICK_MS ?? 300_000);
/** A block/unblock the device hasn't answered within this time may be sent again */
export const PENDING_MAX_MS = 30 * 60_000;
/** Changes queued per pass, so a mistake can never sweep the whole gym at once */
export const MAX_CHANGES = 20;

export interface EnforceIdentity extends IdentityLike {
  id: string; deviceUserId: string; personType?: string | null; memberId?: string | null; trainerId?: string | null;
  deviceAccess?: DeviceAccess | null; deviceAccessPending?: DeviceAccess | null; deviceAccessPendingAtMs?: number | null;
}
export interface EnforceMember extends MemberAccessLike { id: string; name?: string }
export interface Change { identityId: string; deviceUserId: string; want: DeviceAccess; reason: DenyReason | null; name: string; personType: 'member' | 'trainer'; personId: string | null }

/** IST calendar day — memberships end on a local date */
export const istDay = (ms = Date.now()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(ms));

/**
 * What must change on the device: CRM-managed users whose device state (open/blocked) differs from
 * what the CRM decides today. A change already sent and not yet answered isn't sent again (unless
 * it's been waiting longer than PENDING_MAX_MS). Pure — no reads or writes.
 */
export function planAccess(ids: EnforceIdentity[], members: Map<string, EnforceMember>, trainers: Map<string, { name?: string }>, day: string, now = Date.now()): Change[] {
  const out: Change[] = [];
  for (const i of ids) {
    if (i.managedBy !== 'crm' || i.status === 'REMOVED' || !/^\d{1,9}$/.test(i.deviceUserId)) continue;
    const trainer = i.personType === 'trainer';
    const m = trainer ? null : members.get(i.memberId ?? '') ?? null;
    const t = trainer ? trainers.get(i.trainerId ?? '') : undefined;
    const d = trainer ? trainerDecision(i, !!t) : memberDecision(i, m, day);
    // A link whose member/trainer record wasn't found: never act on missing data
    if (d.reason === 'BIOMETRIC_NOT_LINKED') continue;
    const want: DeviceAccess = d.decision === 'ACCESS_ALLOWED' ? 'open' : 'blocked';
    const have: DeviceAccess = i.deviceAccess ?? 'open';
    const waiting = i.deviceAccessPending && now - (i.deviceAccessPendingAtMs ?? 0) < PENDING_MAX_MS ? i.deviceAccessPending : null;
    if (waiting === want) continue;
    if (!waiting && want === have) continue;
    out.push({ identityId: i.id, deviceUserId: i.deviceUserId, want, reason: d.reason, name: (trainer ? t?.name : m?.name) ?? '', personType: trainer ? 'trainer' : 'member', personId: (trainer ? i.trainerId : i.memberId) ?? null });
    if (out.length >= MAX_CHANGES) break;
  }
  return out;
}

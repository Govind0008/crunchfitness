// MOCK — FOR TESTS ONLY. An in-memory stand-in for an access-control device, used to check the
// eligibility → sync flow and duplicate-punch handling. It is not imported by the app, talks to
// no hardware, and must never be wired into production.
import { deviceEventKey, type AccessControlProvider, type AccessEligibility, type DeviceAttendanceEvent, type MemberAccessState } from './index';

export class MockAccessProvider implements AccessControlProvider {
  readonly name = 'MOCK (tests only)';
  private members = new Map<string, MemberAccessState & { until: string | null }>();
  private events = new Map<string, DeviceAttendanceEvent>();
  /** Simulate an unreachable device */
  offline = false;

  private set(memberId: string, status: MemberAccessState['status'], until: string | null, lastError: string | null = null) {
    const s = { memberId, deviceMemberId: `mock-${memberId}`, status, until, lastSyncedAt: lastError ? null : new Date().toISOString(), lastError };
    this.members.set(memberId, s);
    return s;
  }
  private guard(memberId: string, until: string | null) {
    return this.offline ? this.set(memberId, 'ACCESS_SYNC_FAILED', until, 'Device unavailable') : null;
  }

  async provisionMember(memberId: string, until: string) { return this.guard(memberId, until) ?? this.set(memberId, 'ACCESS_ACTIVE', until); }
  async updateMember(memberId: string, until: string) { return this.guard(memberId, until) ?? this.set(memberId, 'ACCESS_ACTIVE', until); }
  async disableMember(memberId: string) { return this.guard(memberId, null) ?? this.set(memberId, 'ACCESS_DISABLED', null); }
  async removeMember(memberId: string) { this.members.delete(memberId); }
  async getMemberStatus(memberId: string): Promise<MemberAccessState> {
    return this.members.get(memberId) ?? { memberId, deviceMemberId: null, status: 'ACCESS_UNKNOWN', lastSyncedAt: null, lastError: null };
  }
  async syncMember(memberId: string, e: AccessEligibility) {
    // Unknown eligibility never grants access
    return e.eligible === true && 'until' in e ? this.updateMember(memberId, e.until) : this.disableMember(memberId);
  }
  async getDeviceStatus() {
    return { connectorStatus: this.offline ? 'offline' as const : 'online' as const, lastSuccessfulSync: null, lastError: this.offline ? 'Device unavailable' : null };
  }
  async receiveAttendanceEvent(e: DeviceAttendanceEvent) {
    const key = deviceEventKey(e);
    if (this.events.has(key)) return { stored: false, key };
    this.events.set(key, e);
    return { stored: true, key };
  }
}

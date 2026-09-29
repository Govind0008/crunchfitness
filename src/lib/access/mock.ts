// MOCK — FOR TESTS ONLY. An in-memory stand-in for an access-control device, used to check the
// eligibility → sync flow and duplicate-scan handling. It is not imported by the app, talks to
// no hardware, and must never be wired into production.
import { deviceEventKey, type AccessControlProvider, type AccessEligibility, type BiometricStatus, type RawDeviceEvent } from './index';

export class MockAccessProvider implements AccessControlProvider {
  readonly name = 'MOCK (tests only)';
  private users = new Map<string, { status: BiometricStatus; name: string }>();
  private events = new Map<string, RawDeviceEvent>();
  /** Simulate an unreachable device */
  offline = false;

  private k = (deviceId: string, u: string) => `${deviceId}/${u}`;
  private set(deviceId: string, u: string, status: BiometricStatus) {
    if (this.offline) return 'SYNC_FAILED' as const;
    const cur = this.users.get(this.k(deviceId, u));
    this.users.set(this.k(deviceId, u), { name: cur?.name ?? '', status });
    return status;
  }

  async registerDevice() {}
  async getDeviceStatus() { return { health: this.offline ? 'offline' as const : 'online' as const, lastError: this.offline ? 'Device unavailable' : null }; }
  async enrollMember(deviceId: string, u: string, name: string) {
    if (this.offline) return 'SYNC_FAILED' as const;
    this.users.set(this.k(deviceId, u), { name, status: 'SYNCED' });
    return 'SYNCED' as const;
  }
  async disableMemberAccess(deviceId: string, u: string) { return this.set(deviceId, u, 'DISABLED'); }
  async enableMemberAccess(deviceId: string, u: string) { return this.set(deviceId, u, 'SYNCED'); }
  async removeMember(deviceId: string, u: string) { if (this.offline) return 'SYNC_FAILED' as const; this.users.delete(this.k(deviceId, u)); return 'REMOVED' as const; }
  async syncMember(deviceId: string, u: string, e: AccessEligibility) {
    // Unknown eligibility never grants access
    return e.eligible === true ? this.enableMemberAccess(deviceId, u) : this.disableMemberAccess(deviceId, u);
  }
  async processAttendanceEvent(raw: RawDeviceEvent) {
    const key = deviceEventKey(raw);
    if (this.events.has(key)) return { stored: false, key };
    this.events.set(key, raw);
    return { stored: true, key };
  }
  async getDeviceUsers(deviceId: string) {
    return [...this.users.entries()].filter(([k]) => k.startsWith(`${deviceId}/`)).map(([k, v]) => ({ deviceUserId: k.split('/')[1], name: v.name, enrolled: v.status !== 'REMOVED' }));
  }
  async healthCheck() { return { ok: !this.offline, message: this.offline ? 'Device unavailable' : 'MOCK online' }; }
}

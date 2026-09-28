import { test, expect } from '@playwright/test';
import { accessEligibility, deviceEventKey, type DeviceAttendanceEvent } from '../../src/lib/access';
import { MockAccessProvider } from '../../src/lib/access/mock';

// Access-control readiness: pure eligibility from membership, and a MOCK provider (tests only —
// no real device is connected) to check the sync flow and duplicate device punches.
test.skip(({ isMobile }) => isMobile, 'logic tests run once');

const today = '2030-06-15';

test('eligibility comes from the membership alone', () => {
  expect(accessEligibility({ status: 'active', membershipEnd: '2030-07-01' }, today)).toEqual({ eligible: true, reason: 'Active membership', until: '2030-07-01' });
  expect(accessEligibility({ status: 'active', membershipEnd: today }, today).eligible).toBe(true);      // last day still counts
  expect(accessEligibility({ status: 'active', membershipEnd: '2030-06-14' }, today).eligible).toBe(false);
  expect(accessEligibility({ status: 'inactive', membershipEnd: '2030-07-01' }, today).eligible).toBe(false);
  expect(accessEligibility({ status: 'active', membershipEnd: null }, today).eligible).toBeNull();      // unknown ≠ allowed
});

test('membership status and device sync status stay separate', async () => {
  const device = new MockAccessProvider();
  expect(device.name).toMatch(/MOCK/);
  expect((await device.getMemberStatus('m1')).status).toBe('ACCESS_UNKNOWN');
  expect((await device.syncMember('m1', accessEligibility({ status: 'active', membershipEnd: '2030-07-01' }, today))).status).toBe('ACCESS_ACTIVE');
  expect((await device.syncMember('m1', accessEligibility({ status: 'active', membershipEnd: null }, today))).status).toBe('ACCESS_DISABLED');
  device.offline = true;
  const failed = await device.syncMember('m2', accessEligibility({ status: 'active', membershipEnd: '2030-07-01' }, today));
  expect(failed).toMatchObject({ status: 'ACCESS_SYNC_FAILED', lastError: 'Device unavailable' });   // membership is still active; only the sync failed
});

test('the same device punch is stored once', async () => {
  const device = new MockAccessProvider();
  const punch: DeviceAttendanceEvent = { gymId: 'crunch-wakad', deviceId: 'door-1', deviceMemberId: '0042', timestamp: '2030-06-15T07:01:00+05:30', type: 'entry' };
  const a = await device.receiveAttendanceEvent(punch);
  const b = await device.receiveAttendanceEvent({ ...punch, timestamp: '2030-06-15T01:31:00Z' });     // same instant, other format
  expect(a.stored).toBe(true);
  expect(b).toEqual({ stored: false, key: a.key });
  expect(deviceEventKey({ ...punch, type: 'exit' })).not.toBe(a.key);
  expect(() => deviceEventKey({ ...punch, timestamp: 'not a date' })).toThrow();
});

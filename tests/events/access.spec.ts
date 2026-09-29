import { test, expect } from '@playwright/test';
import {
  NotConfiguredProvider, accessEligibility, deviceEventKey, deviceHealth, deviceTimeToIso, processAttendanceEvent,
  type RawDeviceEvent,
} from '../../src/lib/access';
import { parseAttlog } from '../../src/lib/access/adms';
import { MockAccessProvider } from '../../src/lib/access/mock';

// Access-control domain logic: eligibility, device health, ADMS parsing and scan processing.
// No hardware anywhere — the provider used here is the clearly-labelled test MOCK.
test.skip(({ isMobile }) => isMobile, 'logic tests run once');

const today = '2030-06-15';
const active = { status: 'active' as const, membershipEnd: '2030-07-01' };

test('eligibility: active yes, expired no, PT-only no, manual block and suspension always win', () => {
  expect(accessEligibility(active, today)).toEqual({ eligible: true, reason: 'Active membership', until: '2030-07-01' });
  expect(accessEligibility({ ...active, membershipEnd: today }, today).eligible).toBe(true);                // last day still counts
  expect(accessEligibility({ ...active, membershipEnd: '2030-06-14' }, today).eligible).toBe(false);
  expect(accessEligibility({ status: 'inactive', membershipEnd: '2030-07-01' }, today).eligible).toBe(false);
  // PT only: no gym membership on record → never allowed (PT isn't even an input)
  expect(accessEligibility({ status: 'inactive', membershipEnd: null }, today).eligible).toBe(false);
  expect(accessEligibility({ status: 'active', membershipEnd: null }, today)).toMatchObject({ eligible: null, reason: 'No gym membership on record' });
  const blocked = accessEligibility({ ...active, accessOverride: 'blocked', accessOverrideReason: 'Card shared' }, today);
  expect(blocked).toMatchObject({ eligible: false, reason: 'Blocked by staff — Card shared' });
  expect(accessEligibility({ ...active, accessOverride: 'suspended' }, today).eligible).toBe(false);
});

test('a device is online only when the integration service has heard from it recently', () => {
  const now = Date.parse('2030-06-15T10:00:00Z');
  const at = (ms: number) => ({ toDate: () => new Date(ms) });
  expect(deviceHealth({ enabled: true, lastSeenAt: null }, now)).toBe('never_connected');
  expect(deviceHealth({ enabled: true, lastSeenAt: at(now - 60_000) }, now)).toBe('online');
  expect(deviceHealth({ enabled: true, lastSeenAt: at(now - 60 * 60_000) }, now)).toBe('offline');
  expect(deviceHealth({ enabled: false, lastSeenAt: at(now) }, now)).toBe('disabled');
});

test('ADMS ATTLOG lines are parsed; bad lines are reported, not guessed', () => {
  const body = ['1042\t2030-06-15 07:01:12\t0\t1\t0\t0', '7\t2030-06-15 07:05:00\t0\t15', 'bad line', '\t2030-06-15 07:06:00\t0\t1', '99\tyesterday\t0\t1', ''].join('\n');
  const r = parseAttlog(body, { gymId: 'crunch-wakad', deviceId: 'dev1' });
  expect(r.events).toEqual([
    { gymId: 'crunch-wakad', deviceId: 'dev1', deviceUserId: '1042', deviceTime: '2030-06-15 07:01:12', verify: 'fingerprint', statusCode: '0' },
    { gymId: 'crunch-wakad', deviceId: 'dev1', deviceUserId: '7', deviceTime: '2030-06-15 07:05:00', verify: 'face', statusCode: '0' },
  ]);
  expect(r.skipped.map((s) => s.reason)).toEqual(['No valid user ID', 'No valid user ID', 'No valid time']);
  expect(deviceTimeToIso('2030-06-15 07:01:12')).toBe('2030-06-15T01:31:12.000Z');                        // IST → instant
});

test('scans resolve to members: granted, denied, access disabled, unknown user', () => {
  const raw: RawDeviceEvent = { gymId: 'crunch-wakad', deviceId: 'dev1', deviceUserId: '1042', deviceTime: '2030-06-15 07:01:12', verify: 'fingerprint', statusCode: '0' };
  const id = { memberId: 'm1', status: 'SYNCED' as const };
  expect(processAttendanceEvent(raw, id, active, today)).toMatchObject({ memberId: 'm1', result: 'granted' });
  expect(processAttendanceEvent(raw, id, { status: 'active', membershipEnd: '2030-01-01' }, today)).toMatchObject({ result: 'denied', reason: 'Membership expired on 2030-01-01' });
  expect(processAttendanceEvent(raw, id, { ...active, accessOverride: 'blocked' }, today)).toMatchObject({ result: 'denied' });
  expect(processAttendanceEvent(raw, { memberId: 'm1', status: 'DISABLED' }, active, today)).toMatchObject({ result: 'access_disabled' });
  expect(processAttendanceEvent({ ...raw, deviceUserId: '555' }, null, null, today)).toMatchObject({ memberId: null, result: 'unknown_user' });
});

test('the same scan reported twice is stored once; different devices stay separate', async () => {
  const raw: RawDeviceEvent = { gymId: 'crunch-wakad', deviceId: 'dev1', deviceUserId: '1042', deviceTime: '2030-06-15 07:01:12', verify: 'fingerprint', statusCode: '0' };
  const device = new MockAccessProvider();
  expect(device.name).toMatch(/MOCK/);
  const a = await device.processAttendanceEvent(raw);
  const b = await device.processAttendanceEvent({ ...raw, deviceTime: '2030-06-15T07:01:12' });              // same moment, other format
  expect(a.stored).toBe(true);
  expect(b).toEqual({ stored: false, key: a.key });
  expect(deviceEventKey({ ...raw, deviceId: 'dev2' })).not.toBe(a.key);                                        // two devices = two scans
  expect(deviceEventKey({ ...raw, gymId: 'other-gym' })).not.toBe(a.key);
  expect(() => deviceEventKey({ ...raw, deviceTime: 'not a date' })).toThrow();
});

test('sync results come from the device, and a failed sync is reported as failed', async () => {
  const device = new MockAccessProvider();
  expect(await device.enrollMember('dev1', '1042', 'Asha')).toBe('SYNCED');
  expect(await device.syncMember('dev1', '1042', accessEligibility({ status: 'active', membershipEnd: '2030-01-01' }, today))).toBe('DISABLED');
  expect(await device.syncMember('dev1', '1042', accessEligibility({ status: 'active', membershipEnd: null }, today))).toBe('DISABLED');   // unknown ≠ allowed
  device.offline = true;
  expect(await device.syncMember('dev1', '1042', accessEligibility(active, today))).toBe('SYNC_FAILED');
  expect((await device.getDeviceUsers('dev1')).map((u) => u.deviceUserId)).toEqual(['1042']);
  expect(await device.getDeviceUsers('dev2')).toEqual([]);                                                    // users are per device
});

test('without an integration, every device action says so — nothing pretends to work', async () => {
  const p = new NotConfiguredProvider();
  expect(await p.healthCheck()).toEqual({ ok: false, message: 'Device integration not configured' });
  await expect(p.enrollMember('dev1', '1', 'x')).rejects.toThrow('Device integration not configured');
  await expect(p.syncMember('dev1', '1', accessEligibility(active, today))).rejects.toThrow('not configured');
});

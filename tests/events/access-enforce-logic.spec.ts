import { test, expect } from '@playwright/test';
import { planAccess, PENDING_MAX_MS, type EnforceIdentity, type EnforceMember } from '../../api/_lib/enforce';

// Which CRM-managed users must be blocked/unblocked on the device today. Old-system users are
// never touched; missing data never causes a block; a change already sent isn't sent twice.
test.skip(({ isMobile }) => isMobile, 'logic test runs once');

const DAY = '2026-10-27';
const id = (pin: string, x: Partial<EnforceIdentity> = {}): EnforceIdentity => ({ id: `dev_${pin}`, deviceUserId: pin, managedBy: 'crm', status: 'SYNCED', accessEnabled: true, personType: 'member', memberId: `m${pin}`, ...x });
const members = new Map<string, EnforceMember>([
  ['m1', { id: 'm1', name: 'Paid Up', status: 'active', membershipEnd: '2026-12-31' }],
  ['m2', { id: 'm2', name: 'Expired', status: 'active', membershipEnd: '2026-10-26' }],
  ['m3', { id: 'm3', name: 'Blocked By Staff', status: 'active', membershipEnd: '2026-12-31', accessOverride: 'blocked' }],
  ['m4', { id: 'm4', name: 'Ends Today', status: 'active', membershipEnd: DAY }],
]);

test('expired, blocked or switched off → block; paid up (incl. ending today) → nothing; renewed → unblock', () => {
  const c = planAccess([id('1'), id('2'), id('3'), id('4'), id('5', { memberId: 'm1', accessEnabled: false })], members, new Map(), DAY);
  expect(c.map((x) => [x.deviceUserId, x.want, x.reason])).toEqual([['2', 'blocked', 'MEMBERSHIP_EXPIRED'], ['3', 'blocked', 'MEMBER_BLOCKED'], ['5', 'blocked', 'ACCESS_DISABLED']]);
  expect(c[0]).toMatchObject({ name: 'Expired', personType: 'member', personId: 'm2' });
  // Blocked on the device, membership now paid → unblock
  expect(planAccess([id('1', { deviceAccess: 'blocked' })], members, new Map(), DAY).map((x) => x.want)).toEqual(['open']);
  // Already blocked and still expired → nothing
  expect(planAccess([id('2', { deviceAccess: 'blocked' })], members, new Map(), DAY)).toEqual([]);
});

test('old-system users, removed links, missing members and non-numeric IDs are never touched', () => {
  expect(planAccess([
    id('2', { managedBy: 'legacy' }), id('2b', { memberId: 'm2' }), id('6', { managedBy: null, memberId: 'm2' }),
    id('7', { status: 'REMOVED', memberId: 'm2' }), id('8', { memberId: 'gone' }),
  ], members, new Map(), DAY)).toEqual([]);
});

test('a change already sent waits for the device; after 30 minutes unanswered it may be sent again', () => {
  const now = Date.now();
  expect(planAccess([id('2', { deviceAccessPending: 'blocked', deviceAccessPendingAtMs: now - 60_000 })], members, new Map(), DAY, now)).toEqual([]);
  expect(planAccess([id('2', { deviceAccessPending: 'blocked', deviceAccessPendingAtMs: now - PENDING_MAX_MS - 1 })], members, new Map(), DAY, now)).toHaveLength(1);
  // Renewed while the block was still on its way → unblock straight away
  expect(planAccess([id('1', { deviceAccessPending: 'blocked', deviceAccessPendingAtMs: now - 60_000 })], members, new Map(), DAY, now).map((x) => x.want)).toEqual(['open']);
});

test('trainers: only the access switch; a missing trainer record is never acted on; at most 20 per pass', () => {
  const t = new Map([['T1', { name: 'Coach' }]]);
  expect(planAccess([id('9', { personType: 'trainer', memberId: null, trainerId: 'T1', accessEnabled: false })], members, t, DAY).map((x) => [x.want, x.name])).toEqual([['blocked', 'Coach']]);
  expect(planAccess([id('9', { personType: 'trainer', memberId: null, trainerId: 'T1' })], members, t, DAY)).toEqual([]);
  expect(planAccess([id('9', { personType: 'trainer', memberId: null, trainerId: 'gone', accessEnabled: false })], members, t, DAY)).toEqual([]);
  expect(planAccess(Array.from({ length: 30 }, (_, k) => id(String(100 + k), { memberId: 'm2' })), members, new Map(), DAY)).toHaveLength(20);
});

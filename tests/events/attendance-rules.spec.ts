import { test, expect } from '@playwright/test';
import { PROJECT, resetFirestore, seedDoc, ts } from './emulator';
import { localDay, onLeave, personOf, trainerDay } from '../../api/_lib/attendance';

// Attendance derived from device punches (api/_lib/ingest.ts, reconcile.ts) against the emulator:
//   member punch  → accessEvents + one checkins visit per member per local day
//   trainer punch → accessEvents + trainerAttendance (first punch = in, last = out)
//   unknown user  → accessEvents only, unresolved
// Named *-rules so it runs once (desktop project only).
test.describe.configure({ mode: 'serial' });
test.skip(({ isMobile }) => isMobile, 'server test runs once');

type Fs = import('firebase-admin/firestore').Firestore;
let fs: Fs;
let ingest: typeof import('../../api/_lib/ingest').ingestScans;
let recon: typeof import('../../api/_lib/reconcile');
const DEV = 'dev1';
const scan = (pin: string, time: string) => ({ pin, time, status: '0', verify: '1' });
const get = async (path: string) => (await fs.doc(path).get()).data();
const eventsOf = async (pin: string) => (await fs.collection('accessEvents').where('deviceUserId', '==', pin).get()).docs.map((d) => ({ id: d.id, ...d.data() }) as Record<string, unknown>);
const H = 3600_000;

test.beforeAll(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085';
  process.env.GCLOUD_PROJECT = PROJECT;
  const { firestoreOrNull } = await import('../../api/_lib/firebase');
  fs = firestoreOrNull()!;
  ingest = (await import('../../api/_lib/ingest')).ingestScans;
  recon = await import('../../api/_lib/reconcile');
  await resetFirestore();
  await seedDoc(`gyms/crunch-wakad/devices/${DEV}`, { gymId: 'crunch-wakad', name: 'Main entrance', model: 'eSSL X2008', serialNumber: 'SN1', enabled: true });
  await seedDoc('members/m1', { name: 'Asha Rao', phone: '9000000001', phoneKey: '9000000001', status: 'active', membershipEnd: '2099-12-31', activeUntil: '2099-12-31' });
  await seedDoc('members/m2', { name: 'Old Member', phone: '9000000002', phoneKey: '9000000002', status: 'active', membershipEnd: '2020-01-01', activeUntil: '2020-01-01' });
  await seedDoc('members/m3', { name: 'Desk Member', phone: '9000000003', phoneKey: '9000000003', status: 'active', membershipEnd: '2099-12-31', activeUntil: '2099-12-31' });
  await seedDoc('teamMembers/T1', { name: 'Coach One', role: 'Coach' });
  await seedDoc('teamMembers/T2', { name: 'Coach Two', role: 'Coach' });
  const id = (uid: string, extra: Record<string, string | null>) => seedDoc(`biometricIdentities/${DEV}_${uid}`, { gymId: 'crunch-wakad', deviceId: DEV, deviceUserId: uid, method: 'fingerprint', status: 'ENROLLED', ...extra });
  await id('1', { personType: 'member', memberId: 'm1', trainerId: null });
  await id('2', { memberId: 'm2' });                                                         // older link: no personType = member
  await id('3', { personType: 'member', memberId: 'm3', trainerId: null });
  await id('7', { personType: 'trainer', memberId: null, trainerId: 'T1' });
  await id('8', { personType: 'trainer', memberId: null, trainerId: 'T2' });
  await id('9', { personType: 'trainer', memberId: null, trainerId: 'T1' }); await fs.doc(`biometricIdentities/${DEV}_9`).update({ status: 'REMOVED' });
  await seedDoc(`gyms/crunch-wakad/devices/${DEV}/deviceUsers/44`, { deviceUserId: '44', name: 'RAVI K' });
  await seedDoc('trainerLeave/L1', { trainerId: 'T2', from: '2026-09-21', to: '2026-09-22', type: 'sick', reason: '', status: 'approved', notes: '' });
  await seedDoc('trainerLeave/L2', { trainerId: 'T2', from: '2026-09-23', to: '2026-09-23', type: 'casual', reason: '', status: 'pending', notes: '' });
  await seedDoc('trainerLeave/L3', { trainerId: 'T2', from: '2026-09-24', to: '2026-09-24', type: 'casual', reason: '', status: 'cancelled', notes: '' });
});

// ── Pure rules ────────────────────────────────────────────────────────────────
test('trainer day rules: one punch, two, many, none, manual check-out — nothing invented', () => {
  const t0 = Date.parse('2026-09-20T03:30:00Z');
  expect(trainerDay([])).toMatchObject({ status: 'NO_ATTENDANCE_RECORDED', firstAt: null, checkoutAt: null, durationMs: null });
  expect(trainerDay([t0])).toMatchObject({ status: 'MISSING_CHECKOUT', firstAt: t0, checkoutAt: null, durationMs: null, punchCount: 1 });
  expect(trainerDay([t0 + 8 * H, t0])).toMatchObject({ status: 'COMPLETED', firstAt: t0, checkoutAt: t0 + 8 * H, durationMs: 8 * H });          // order doesn't matter
  expect(trainerDay([t0 + 2 * H, t0 + 9 * H, t0, t0 + 5 * H])).toMatchObject({ firstAt: t0, checkoutAt: t0 + 9 * H, punchCount: 4 });          // middle punches ignored
  expect(trainerDay([t0, t0])).toMatchObject({ status: 'MISSING_CHECKOUT', punchCount: 1 });                                                     // the same punch twice
  const manual = trainerDay([t0], { manualCheckoutMs: t0 + 7 * H });
  expect(manual).toMatchObject({ status: 'COMPLETED', checkoutAt: t0 + 7 * H, lastAt: null, exceptions: ['MANUAL_CHECKOUT'] });
  expect(trainerDay([t0], { manualCheckoutMs: t0 - H })).toMatchObject({ status: 'MISSING_CHECKOUT', checkoutAt: null });                       // before check-in: ignored
  expect(trainerDay([t0, t0 + 6 * H], { manualCheckoutMs: t0 + 7 * H })).toMatchObject({ checkoutAt: t0 + 6 * H, exceptions: [] });            // a real punch wins
  expect(trainerDay([t0], { onApprovedLeave: true }).exceptions).toEqual(['PUNCH_DURING_APPROVED_LEAVE']);
});

test('local day, leave and person resolution', () => {
  expect(localDay('2026-09-30 00:15:00')).toBe('2026-09-30');       // just after midnight India time, not the UTC day before
  expect(localDay('2026-09-29 23:59:59')).toBe('2026-09-29');
  const leaves = [{ from: '2026-09-21', to: '2026-09-22', status: 'approved' }, { from: '2026-09-23', to: '2026-09-23', status: 'pending' }];
  expect(onLeave('2026-09-22', leaves)).toBe(true);
  expect(onLeave('2026-09-23', leaves)).toBe(false);                // pending isn't leave
  expect(personOf(null)).toEqual({ type: 'unknown', id: null });
  expect(personOf({ memberId: 'm1' })).toEqual({ type: 'member', id: 'm1' });
  expect(personOf({ personType: 'trainer', trainerId: 'T1', memberId: null })).toEqual({ type: 'trainer', id: 'T1' });
  expect(personOf({ personType: 'trainer', trainerId: null, memberId: null })).toEqual({ type: 'unknown', id: null });
});

// ── Members ───────────────────────────────────────────────────────────────────
test('a member punch becomes their visit for that local day, linked both ways', async () => {
  const r = await ingest(fs, DEV, [scan('1', '2026-09-20 06:10:00')]);
  expect(r).toMatchObject({ events: 1, members: 1, attendanceCreated: 1 });
  const [ev] = await eventsOf('1');
  expect(ev).toMatchObject({ personType: 'member', memberId: 'm1', trainerId: null, localDate: '2026-09-20', at: '2026-09-20T00:40:00.000Z', source: 'adms-relay', attendanceRef: 'checkins/2026-09-20_m1', gymId: 'crunch-wakad', deviceId: DEV, deviceUserId: '1' });
  const visit = await get('checkins/2026-09-20_m1');
  expect(visit).toMatchObject({ memberId: 'm1', gymId: 'crunch-wakad', date: '2026-09-20', method: 'biometric', sources: ['biometric'], deviceId: DEV, deviceUserId: '1', eventIds: [ev.id], punchCount: 1 });
  expect(visit!.at.toDate().toISOString()).toBe('2026-09-20T00:40:00.000Z');
  expect(visit!.createdAt).toBeTruthy();
  expect((await get('members/m1'))!.lastVisitAt.toDate().toISOString()).toBe('2026-09-20T00:40:00.000Z');
  expect(await get(`biometricIdentities/${DEV}_1`)).toMatchObject({ status: 'SYNCED' });
});

test('more punches the same day stay one visit; re-delivery changes nothing', async () => {
  await ingest(fs, DEV, [scan('1', '2026-09-20 19:30:00'), scan('1', '2026-09-20 06:10:00')]);   // the second is a re-delivery
  const visit = await get('checkins/2026-09-20_m1');
  expect(visit).toMatchObject({ punchCount: 2 });
  expect(visit!.eventIds).toHaveLength(2);
  expect(visit!.at.toDate().toISOString()).toBe('2026-09-20T00:40:00.000Z');                  // first punch
  expect(visit!.lastAt.toDate().toISOString()).toBe('2026-09-20T14:00:00.000Z');              // last punch
  expect(await eventsOf('1')).toHaveLength(2);
  const again = await ingest(fs, DEV, [scan('1', '2026-09-20 19:30:00')]);
  expect(again).toMatchObject({ attendanceCreated: 0, attendanceUpdated: 0 });
  expect((await get('checkins/2026-09-20_m1'))!.punchCount).toBe(2);
});

test('after midnight is the next local day: a second visit', async () => {
  await ingest(fs, DEV, [scan('1', '2026-09-21 00:15:00')]);
  expect(await get('checkins/2026-09-21_m1')).toMatchObject({ date: '2026-09-21', punchCount: 1 });
  expect((await get('checkins/2026-09-21_m1'))!.at.toDate().toISOString()).toBe('2026-09-20T18:45:00.000Z');
});

test('an expired member’s punch is still their visit; the event records the membership result', async () => {
  await ingest(fs, DEV, [scan('2', '2026-09-20 07:00:00')]);
  const [ev] = await eventsOf('2');
  expect(ev).toMatchObject({ personType: 'member', memberId: 'm2', result: 'denied' });
  expect(await get('checkins/2026-09-20_m2')).toMatchObject({ memberId: 'm2', punchCount: 1 });
});

test('a punch on a day checked in at the desk joins that visit, keeping both sources', async () => {
  await seedDoc('checkins/2026-09-20_m3', { memberId: 'm3', memberName: 'Desk Member', memberPhoneKey: '9000000003', date: '2026-09-20', method: 'manual', by: 'staff', at: ts('2026-09-20T03:00:00Z') });
  const r = await ingest(fs, DEV, [scan('3', '2026-09-20 09:45:00')]);
  expect(r.attendanceUpdated).toBe(1);
  const visit = await get('checkins/2026-09-20_m3');
  expect(visit).toMatchObject({ method: 'manual', sources: ['manual', 'biometric'], punchCount: 1 });
  expect(visit!.at.toDate().toISOString()).toBe('2026-09-20T03:00:00.000Z');                   // the desk check-in was earlier
});

// ── Trainers ──────────────────────────────────────────────────────────────────
test('trainer: one punch is a check-in with no check-out, never a member visit', async () => {
  await ingest(fs, DEV, [scan('7', '2026-09-20 06:00:00')]);
  const day = await get('trainerAttendance/2026-09-20_T1');
  expect(day).toMatchObject({ trainerId: 'T1', trainerName: 'Coach One', date: '2026-09-20', status: 'MISSING_CHECKOUT', checkoutAt: null, durationMs: null, punchCount: 1 });
  const [ev] = await eventsOf('7');
  expect(ev).toMatchObject({ personType: 'trainer', trainerId: 'T1', memberId: null, attendanceRef: 'trainerAttendance/2026-09-20_T1' });
  expect((await fs.collection('checkins').where('deviceUserId', '==', '7').get()).size).toBe(0);
});

test('trainer: later punches — the last is the check-out; middle punches stay events; out of order is fine', async () => {
  await ingest(fs, DEV, [scan('7', '2026-09-20 21:00:00'), scan('7', '2026-09-20 13:00:00')]);
  const day = await get('trainerAttendance/2026-09-20_T1');
  expect(day).toMatchObject({ status: 'COMPLETED', punchCount: 3, durationMs: 15 * H, exceptions: [] });
  expect(day!.firstAt.toDate().toISOString()).toBe('2026-09-20T00:30:00.000Z');
  expect(day!.checkoutAt.toDate().toISOString()).toBe('2026-09-20T15:30:00.000Z');
  expect(await eventsOf('7')).toHaveLength(3);
  // Re-delivered: nothing changes
  await ingest(fs, DEV, [scan('7', '2026-09-20 13:00:00')]);
  expect((await get('trainerAttendance/2026-09-20_T1'))!.punchCount).toBe(3);
});

test('trainer: 23:59 and 00:05 are two different days', async () => {
  await ingest(fs, DEV, [scan('7', '2026-09-26 23:59:00'), scan('7', '2026-09-27 00:05:00')]);
  expect(await get('trainerAttendance/2026-09-26_T1')).toMatchObject({ status: 'MISSING_CHECKOUT', punchCount: 1 });
  expect(await get('trainerAttendance/2026-09-27_T1')).toMatchObject({ status: 'MISSING_CHECKOUT', punchCount: 1 });   // a Sunday: no weekday rules
});

test('trainer: a punch during approved leave is flagged; pending or cancelled leave isn’t', async () => {
  await ingest(fs, DEV, [scan('8', '2026-09-21 10:00:00'), scan('8', '2026-09-23 10:00:00'), scan('8', '2026-09-24 10:00:00')]);
  expect((await get('trainerAttendance/2026-09-21_T2'))!.exceptions).toEqual(['PUNCH_DURING_APPROVED_LEAVE']);
  expect((await get('trainerAttendance/2026-09-23_T2'))!.exceptions).toEqual([]);
  expect((await get('trainerAttendance/2026-09-24_T2'))!.exceptions).toEqual([]);
});

test('unknown and unlinked device users are kept as unresolved — no attendance, no guessing by name', async () => {
  await ingest(fs, DEV, [scan('44', '2026-09-20 08:00:00'), scan('9', '2026-09-20 08:05:00')]);   // 9 = a removed trainer link
  const [u] = await eventsOf('44');
  expect(u).toMatchObject({ personType: 'unknown', memberId: null, trainerId: null, result: 'unknown_user', attendanceRef: null, deviceUserName: 'RAVI K' });
  const [removed] = await eventsOf('9');
  expect(removed).toMatchObject({ personType: 'unknown', trainerId: null });
  expect((await fs.collection('checkins').where('deviceUserId', 'in', ['44', '9']).get()).size).toBe(0);
  expect((await fs.collection('trainerAttendance').where('date', '==', '2026-09-20').get()).docs.map((d) => d.id)).toEqual(['2026-09-20_T1']);
});

// ── Reconciliation ────────────────────────────────────────────────────────────
test('reconcile finds punches without attendance; backfill creates them once, leaving punches untouched', async () => {
  // Punches stored before attendance existed (as the relay used to write them)
  await seedDoc('accessEvents/crunch-wakad__dev1__1__2026-09-22T07:00:00', { gymId: 'crunch-wakad', deviceId: DEV, deviceUserId: '1', memberId: 'm1', at: '2026-09-22T01:30:00.000Z', result: 'granted', reason: '', verify: 'fingerprint', statusCode: '0' });
  await seedDoc('accessEvents/crunch-wakad__dev1__7__2026-09-22T06:00:00', { gymId: 'crunch-wakad', deviceId: DEV, deviceUserId: '7', memberId: null, at: '2026-09-22T00:30:00.000Z', result: 'unknown_user', reason: '', verify: 'fingerprint', statusCode: '0' });
  const before = await recon.reconcile(fs, '2026-09-20', '2026-09-22');
  expect(before.counts).toMatchObject({ missing_member_attendance: 1, missing_trainer_attendance: 1, unknown_uid: 2 });   // 44 and the removed link 9
  expect(before.issues.find((x) => x.kind === 'unknown_uid' && x.deviceUserId === '44')).toMatchObject({ count: 1, personName: 'RAVI K' });
  expect(before.issues.find((x) => x.kind === 'missing_member_attendance')).toMatchObject({ personId: 'm1', personName: 'Asha Rao', day: '2026-09-22' });

  const done = await recon.backfill(fs, '2026-09-20', '2026-09-22');
  expect(done).toMatchObject({ considered: 2, attendanceCreated: 2 });
  expect(done.after.missing_member_attendance ?? 0).toBe(0);
  expect(done.after.missing_trainer_attendance ?? 0).toBe(0);
  expect(await get('checkins/2026-09-22_m1')).toMatchObject({ punchCount: 1, eventIds: ['crunch-wakad__dev1__1__2026-09-22T07:00:00'] });
  expect(await get('trainerAttendance/2026-09-22_T1')).toMatchObject({ status: 'MISSING_CHECKOUT' });
  // The original punches weren't rewritten
  expect(await get('accessEvents/crunch-wakad__dev1__7__2026-09-22T06:00:00')).toMatchObject({ result: 'unknown_user', memberId: null });
  expect((await get('accessEvents/crunch-wakad__dev1__7__2026-09-22T06:00:00'))!.personType).toBeUndefined();
  // Running it again creates nothing
  expect(await recon.backfill(fs, '2026-09-20', '2026-09-22')).toMatchObject({ considered: 0, attendanceCreated: 0, attendanceUpdated: 0 });
});

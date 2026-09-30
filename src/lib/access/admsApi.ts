import { auth } from '@/lib/firebase-auth';

// The server side of access control (/api/adms). Admin-only calls carry the signed-in admin's ID
// token; the server checks it against userRoles before answering.

export async function admsCall<T>(check: string, opts: { method?: 'GET' | 'POST'; params?: Record<string, string> } = {}): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  const qs = new URLSearchParams({ check, ...(opts.params ?? {}) });
  const r = await fetch(`/api/adms?${qs}`, { method: opts.method ?? 'GET', headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!r.ok) {
    const detail = await r.json().then((j: { error?: string }) => j.error).catch(() => '');
    throw new Error(r.status === 401 ? 'Only admins can use this.' : r.status === 404 ? 'The access service isn’t deployed yet.' : detail || `HTTP ${r.status}`);
  }
  return r.json() as Promise<T>;
}

export type IssueKind = 'missing_member_attendance' | 'missing_trainer_attendance' | 'unknown_uid' | 'attendance_missing_member' | 'attendance_wrong_gym' | 'duplicate_event' | 'duplicate_attendance';
export const ISSUE_LABEL: Record<IssueKind, string> = {
  missing_member_attendance: 'Member punch without attendance',
  missing_trainer_attendance: 'Trainer punch without attendance',
  unknown_uid: 'Device user not linked',
  attendance_missing_member: 'Attendance for a deleted member',
  attendance_wrong_gym: 'Attendance for another gym',
  duplicate_event: 'Same punch stored twice',
  duplicate_attendance: 'Two attendance records for one day',
};
export interface Issue { kind: IssueKind; detail: string; eventId?: string; at?: string; deviceId?: string; deviceUserId?: string; personId?: string; personName?: string; attendanceId?: string; day?: string; count?: number }
export interface Reconciliation { from: string; to: string; eventsChecked: number; attendanceChecked: number; truncated: boolean; counts: Partial<Record<IssueKind, number>>; issues: Issue[] }
export interface BackfillResult { considered: number; attendanceCreated: number; attendanceUpdated: number; after: Partial<Record<IssueKind, number>> }

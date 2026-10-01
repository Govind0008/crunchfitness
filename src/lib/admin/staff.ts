// Staff logins (admin and marketing). Accounts are ordinary Firebase Auth users; what they can
// do comes only from userRoles/{uid}.role, which only admins can write (the rules enforce it).
import { collection, doc, getDocs, query, where } from 'firebase/firestore';
import { deleteDoc, setDoc } from '@/lib/admin/writes';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { deleteApp, initializeApp } from 'firebase/app';
import { USE_EMULATORS, db, firebaseConfig } from '@/lib/firebase';
import { logAdmin, type AdminActor } from './activity';

export interface StaffAccount { uid: string; role: 'admin' | 'marketing'; name?: string; email?: string }

export async function listStaff(): Promise<StaffAccount[]> {
  const snap = await getDocs(query(collection(db, 'userRoles'), where('role', 'in', ['admin', 'marketing'])));
  return snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<StaffAccount, 'uid'>) }))
    .sort((a, b) => a.role.localeCompare(b.role) || (a.email ?? '').localeCompare(b.email ?? ''));
}

/** New marketing login. A secondary app instance creates the account so the admin stays signed in. */
export async function createMarketingLogin(input: { email: string; password: string; name: string }, actor: AdminActor) {
  const app = initializeApp(firebaseConfig, `staff-create-${Date.now()}`);
  try {
    const secondary = getAuth(app);
    if (USE_EMULATORS) connectAuthEmulator(secondary, 'http://127.0.0.1:9099', { disableWarnings: true });
    const cred = await createUserWithEmailAndPassword(secondary, input.email.trim(), input.password);
    await setDoc(doc(db, 'userRoles', cred.user.uid), { role: 'marketing', name: input.name.trim(), email: input.email.trim() });
    await logAdmin(actor, 'Marketing login created', 'staff', cred.user.uid, { email: input.email.trim() });
    return cred.user.uid;
  } finally {
    await deleteApp(app);
  }
}

/** Takes away the account's staff role (the sign-in itself stays, with no access). */
export async function removeStaffAccess(s: StaffAccount, actor: AdminActor) {
  await deleteDoc(doc(db, 'userRoles', s.uid));
  await logAdmin(actor, 'Staff access removed', 'staff', s.uid, { email: s.email ?? '', role: s.role });
}

// ── Trainer portal logins ───────────────────────────────────────────────────
export interface TrainerLogin { uid: string; trainerId: string; name?: string; email?: string }

export async function listTrainerLogins(): Promise<TrainerLogin[]> {
  const snap = await getDocs(query(collection(db, 'userRoles'), where('role', '==', 'trainer')));
  return snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<TrainerLogin, 'uid'>) }));
}

/** A trainer-portal login tied to one team profile. Same secondary-app pattern as marketing logins. */
export async function createTrainerLogin(input: { email: string; password: string; trainerId: string; name: string }, actor: AdminActor) {
  const app = initializeApp(firebaseConfig, `trainer-create-${Date.now()}`);
  try {
    const secondary = getAuth(app);
    if (USE_EMULATORS) connectAuthEmulator(secondary, 'http://127.0.0.1:9099', { disableWarnings: true });
    const cred = await createUserWithEmailAndPassword(secondary, input.email.trim(), input.password);
    await setDoc(doc(db, 'userRoles', cred.user.uid), { role: 'trainer', trainerId: input.trainerId, name: input.name, email: input.email.trim() });
    await logAdmin(actor, 'Trainer login created', 'trainer', input.trainerId, { email: input.email.trim() });
    return cred.user.uid;
  } finally {
    await deleteApp(app);
  }
}

export async function removeTrainerLogin(t: TrainerLogin, actor: AdminActor) {
  await deleteDoc(doc(db, 'userRoles', t.uid));
  await logAdmin(actor, 'Trainer login removed', 'trainer', t.trainerId, { email: t.email ?? '' });
}

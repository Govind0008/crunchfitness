import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';

export type UserRole = 'admin' | 'marketing' | 'trainer' | 'client' | null;

export interface RoleDoc {
  role: UserRole;
  trainerId?: string;
  clientId?: string;
  trainerName?: string;
  name?: string;
  email?: string;
}

export function useRole() {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<RoleDoc | null>(null);
  const [loading, setLoading] = useState(true);
  // The role couldn't be read (offline, rules): callers show a retry instead of waiting forever
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setRole(null); setLoading(false); return; }

    const unsub = onSnapshot(doc(db, 'userRoles', user.uid), (snap) => {
      setRole(snap.exists() ? (snap.data() as RoleDoc) : null);
      setError(null);
      setLoading(false);
    }, (e) => { setError(e.message); setLoading(false); });
    return unsub;
  }, [user, authLoading]);

  return { role, loading, user, error };
}

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';

export type UserRole = 'admin' | 'trainer' | null;

export interface RoleDoc {
  role: UserRole;
  trainerId?: string;
  name?: string;
}

export function useRole() {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<RoleDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setRole(null); setLoading(false); return; }

    const unsub = onSnapshot(doc(db, 'userRoles', user.uid), (snap) => {
      setRole(snap.exists() ? (snap.data() as RoleDoc) : null);
      setLoading(false);
    });
    return unsub;
  }, [user, authLoading]);

  return { role, loading, user };
}

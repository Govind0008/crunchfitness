import { useState, useEffect } from 'react';
import { getStoredUser, type User } from '../lib/api';

export type UserRole = 'admin' | 'trainer' | 'client' | null;

export interface RoleDoc {
  role: UserRole;
  trainerId?: string;
  clientId?: string;
  trainerName?: string;
  name?: string;
  email?: string;
}

function userToRoleDoc(u: User | null): RoleDoc | null {
  if (!u) return null;
  return {
    role: u.role,
    trainerId: u.trainerId,
    clientId:  u.clientId,
    name:      u.name,
    email:     u.email,
  };
}

export function useRole() {
  const [user, setUser] = useState<User | null>(getStoredUser);
  const loading = false; // JWT is synchronous — no network round-trip needed

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'cf_user') setUser(getStoredUser());
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return { role: userToRoleDoc(user), loading, user };
}

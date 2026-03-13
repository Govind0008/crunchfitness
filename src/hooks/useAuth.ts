import { useState, useEffect } from 'react';
import { getStoredUser, type User } from '../lib/api';

export function useAuth() {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(getStoredUser());
    setLoading(false);

    // Re-sync if another tab logs in/out
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'cf_user') {
        setUser(getStoredUser());
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return { user, loading };
}

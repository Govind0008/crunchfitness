import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/firebase';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [roleChecked, setRoleChecked] = useState(false);
  const [isTrainer, setIsTrainer] = useState(false);

  useEffect(() => {
    if (authLoading || !user) { setRoleChecked(true); return; }
    getDoc(doc(db, 'userRoles', user.uid)).then((snap) => {
      // If a userRoles doc exists with role='trainer', block admin access
      setIsTrainer(snap.exists() && snap.data().role === 'trainer');
      setRoleChecked(true);
    });
  }, [user, authLoading]);

  if (authLoading || !roleChecked) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/admin/login" replace />;
  // Trainers who try to hit /admin/dashboard get sent to their own portal
  if (isTrainer) return <Navigate to="/trainer/dashboard" replace />;

  return <>{children}</>;
};

export default ProtectedRoute;

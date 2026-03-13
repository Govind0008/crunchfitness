import { Navigate } from 'react-router-dom';
import { useRole } from '../hooks/useRole';

const ClientRoute = ({ children }: { children: React.ReactNode }) => {
  const { role, loading } = useRole();

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!role) return <Navigate to="/client/login" replace />;
  if (role.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
  if (role.role === 'trainer') return <Navigate to="/trainer/dashboard" replace />;
  if (role.role !== 'client') return <Navigate to="/client/login" replace />;
  return <>{children}</>;
};

export default ClientRoute;

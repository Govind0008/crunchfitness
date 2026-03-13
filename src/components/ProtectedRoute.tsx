import { Navigate } from 'react-router-dom';
import { useRole } from '../hooks/useRole';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { role, loading } = useRole();

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!role || role.role !== 'admin') {
    // Trainers trying to access admin get redirected to their portal
    if (role?.role === 'trainer') return <Navigate to="/trainer/dashboard" replace />;
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;

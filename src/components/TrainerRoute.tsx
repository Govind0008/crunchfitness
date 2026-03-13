import { Navigate } from 'react-router-dom';
import { useRole } from '../hooks/useRole';

const TrainerRoute = ({ children }: { children: React.ReactNode }) => {
  const { role, loading } = useRole();

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!role || (role.role !== 'trainer' && role.role !== 'admin')) {
    return <Navigate to="/trainer/login" replace />;
  }

  return <>{children}</>;
};

export default TrainerRoute;

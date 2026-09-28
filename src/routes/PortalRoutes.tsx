// Guarded portal pages. Kept in their own lazy chunks (see App.tsx) so the route guards —
// and the Firebase Auth SDK they depend on — never load for public visitors.
import ProtectedRoute from '@/components/ProtectedRoute';
import TrainerRoute from '@/components/TrainerRoute';
import ClientRoute from '@/components/ClientRoute';
import AdminDashboard from '@/pages/AdminDashboard';
import TrainerDashboard from '@/pages/TrainerDashboard';
import ClientDashboard from '@/pages/ClientDashboard';

export const AdminArea = () => <ProtectedRoute><AdminDashboard /></ProtectedRoute>;
export const TrainerArea = () => <TrainerRoute><TrainerDashboard /></TrainerRoute>;
export const ClientArea = () => <ClientRoute><ClientDashboard /></ClientRoute>;

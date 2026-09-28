// Guarded trainer and client portal pages (the admin has its own persistent layout). Kept in their own lazy chunks (see App.tsx) so the route guards —
// and the Firebase Auth SDK they depend on — never load for public visitors.
import TrainerRoute from '@/components/TrainerRoute';
import ClientRoute from '@/components/ClientRoute';
import TrainerDashboard from '@/pages/TrainerDashboard';
import ClientDashboard from '@/pages/ClientDashboard';

export const TrainerArea = () => <TrainerRoute><TrainerDashboard /></TrainerRoute>;
export const ClientArea = () => <ClientRoute><ClientDashboard /></ClientRoute>;

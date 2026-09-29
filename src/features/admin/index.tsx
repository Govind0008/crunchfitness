import { Navigate, Route, Routes, useSearchParams } from 'react-router-dom';
import Overview from './Overview';
import MembersPage from './members/MembersPage';
import MemberForm from './members/MemberForm';
import MemberProfile from './members/MemberProfile';
import ImportMembers from './members/ImportMembers';
import AttendancePage from './AttendancePage';
import TrainersPage from './TrainersPage';
import ActivityPage from './ActivityPage';
import SettingsPage from './SettingsPage';
import GymSetup from './GymSetup';
import AccessPage from './access/AccessPage';
import DevicesPage from './access/DevicesPage';
import DeviceUsersPage from './access/DeviceUsersPage';
import PaymentsPage from './payments/PaymentsPage';
import RecordPayment from './payments/RecordPayment';
import PaymentDetail from './payments/PaymentDetail';
import DuesPage from './payments/DuesPage';
import RevenuePage from './payments/RevenuePage';
import ReportsPage from './payments/ReportsPage';
import EnquiriesPage from './content/EnquiriesPage';
import OffersPage from './content/OffersPage';
import PlansPage from './content/PlansPage';
import BlogPage from './content/BlogPage';
import TeamPage from './content/TeamPage';

// Old /admin/dashboard?tab= links (bookmarks, emails) land on the screen that replaced the tab.
// Classes and the duty roster are retired, so those tabs go to the dashboard.
const LEGACY_TAB: Record<string, string> = {
  posts: '/admin/blog', team: '/admin/team', offers: '/admin/offers', plans: '/admin/plans', enquiries: '/admin/enquiries', accounts: '/admin/trainers',
};
const LegacyDashboard = () => {
  const [params] = useSearchParams();
  return <Navigate to={LEGACY_TAB[params.get('tab') ?? ''] ?? '/admin'} replace />;
};

/** Admin 2.0 pages — rendered inside the persistent AdminLayout (which guards them). */
const AdminApp = () => (
  <Routes>
      <Route index element={<Overview />} />
      <Route path="members" element={<MembersPage />} />
      <Route path="members/new" element={<MemberForm />} />
      <Route path="members/import" element={<ImportMembers />} />
      <Route path="members/:id" element={<MemberProfile />} />
      <Route path="members/:id/edit" element={<MemberForm />} />
      <Route path="attendance" element={<AttendancePage />} />
      <Route path="trainers" element={<TrainersPage />} />
      <Route path="activity" element={<ActivityPage />} />
      <Route path="settings" element={<SettingsPage />} />
      <Route path="settings/setup" element={<GymSetup />} />
      <Route path="settings/access" element={<DevicesPage />} />
      <Route path="settings/access/:deviceId/users" element={<DeviceUsersPage />} />
      <Route path="access" element={<AccessPage />} />
      <Route path="payments" element={<PaymentsPage />} />
      <Route path="payments/new" element={<RecordPayment />} />
      <Route path="payments/dues" element={<DuesPage />} />
      <Route path="payments/:id" element={<PaymentDetail />} />
      <Route path="revenue" element={<RevenuePage />} />
      <Route path="reports" element={<ReportsPage />} />
      <Route path="enquiries" element={<EnquiriesPage />} />
      <Route path="offers" element={<OffersPage />} />
      <Route path="plans" element={<PlansPage />} />
      <Route path="blog" element={<BlogPage />} />
      <Route path="team" element={<TeamPage />} />
      <Route path="dashboard" element={<LegacyDashboard />} />
  </Routes>
);

export default AdminApp;

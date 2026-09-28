import { Route, Routes } from 'react-router-dom';
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
import PaymentsPage from './payments/PaymentsPage';
import RecordPayment from './payments/RecordPayment';
import PaymentDetail from './payments/PaymentDetail';
import DuesPage from './payments/DuesPage';
import RevenuePage from './payments/RevenuePage';
import ReportsPage from './payments/ReportsPage';

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
      <Route path="payments" element={<PaymentsPage />} />
      <Route path="payments/new" element={<RecordPayment />} />
      <Route path="payments/dues" element={<DuesPage />} />
      <Route path="payments/:id" element={<PaymentDetail />} />
      <Route path="revenue" element={<RevenuePage />} />
      <Route path="reports" element={<ReportsPage />} />
  </Routes>
);

export default AdminApp;

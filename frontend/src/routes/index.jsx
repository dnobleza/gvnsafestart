import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import AdminLayout from '../features/admin/AdminLayout';
import AuditLogPage from '../features/admin/AuditLogPage';
import AdminBookingDetailPage from '../features/admin/BookingDetailPage';
import BookingsPage from '../features/admin/BookingsPage';
import OverviewPage from '../features/admin/OverviewPage';
import PaymentsPage from '../features/admin/PaymentsPage';
import AdminRatingsPage from '../features/admin/RatingsPage';
import SettingsPage from '../features/admin/SettingsPage';
import AutoCompletePage from '../features/admin/AutoCompletePage';
import AdminNotificationsPage from '../features/admin/AdminNotificationsPage';
import AdminPackagesPage from '../features/admin/PackagesPage';
import AdminsPage from '../features/admin/AdminsPage';
import BranchesPage from '../features/admin/BranchesPage';
import InstructorsPage from '../features/admin/InstructorsPage';
import useAuthBootstrap from '../features/auth/hooks/useAuthBootstrap';
import BookingWizard from '../features/client/booking/BookingWizard';
import ClientLayout from '../features/client/ClientLayout';
import ClientHomePage from '../features/client/HomePage';
import ClientNotificationsPage from '../features/client/ClientNotificationsPage';
import ClientProfilePage from '../features/client/ProfilePage';
import MyBookingDetailPage from '../features/client/MyBookingDetailPage';
import MyBookingsPage from '../features/client/MyBookingsPage';
import MyPackagesPage from '../features/client/MyPackagesPage';
import PackageDetailPage from '../features/client/PackageDetailPage';
import AvailabilityPage from '../features/instructor/AvailabilityPage';
import InstructorBookingDetailPage from '../features/instructor/BookingDetailPage';
import InstructorBookingsPage from '../features/instructor/BookingsPage';
import CashPage from '../features/instructor/CashPage';
import ClientDetailPage from '../features/instructor/ClientDetailPage';
import ClientsPage from '../features/instructor/ClientsPage';
import HomePage from '../features/instructor/HomePage';
import InstructorLayout from '../features/instructor/InstructorLayout';
import InstructorNotificationsPage from '../features/instructor/InstructorNotificationsPage';
import InstructorRatingsPage from '../features/instructor/RatingsPage';
import SchedulePage from '../features/instructor/SchedulePage';
import InstructorProfilePage from '../pages/InstructorProfilePage';
import ChangePasswordPage from '../pages/ChangePasswordPage';
import LandingPage from '../pages/LandingPage';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import NotFoundPage from '../pages/NotFoundPage';
import RequireAuth, { CHANGE_PASSWORD_PATH } from './RequireAuth';
import RequireRole from './RequireRole';

const ADMIN_ONLY = ['ADMIN'];
const INSTRUCTOR_ONLY = ['INSTRUCTOR'];
const CLIENT_ONLY = ['CLIENT'];

// Old links (landing "Book now", emails) keep working and keep their query.
function RedirectTo({ to }) {
  const { search } = useLocation();
  return <Navigate to={`${to}${search}`} replace />;
}

export default function AppRoutes() {
  useAuthBootstrap();

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/book" element={<RedirectTo to="/client/book" />} />
      <Route element={<RequireAuth />}>
        <Route path={CHANGE_PASSWORD_PATH} element={<ChangePasswordPage />} />
        <Route element={<RequireRole roles={CLIENT_ONLY} />}>
          <Route path="/client" element={<ClientLayout />}>
            <Route index element={<ClientHomePage />} />
            <Route path="book" element={<BookingWizard />} />
            <Route path="packages" element={<MyPackagesPage />} />
            <Route path="packages/:id" element={<PackageDetailPage />} />
            <Route path="bookings" element={<MyBookingsPage />} />
            <Route path="bookings/:id" element={<MyBookingDetailPage />} />
            <Route path="notifications" element={<ClientNotificationsPage />} />
            <Route path="profile" element={<ClientProfilePage />} />
          </Route>
        </Route>
        <Route element={<RequireRole roles={INSTRUCTOR_ONLY} />}>
          <Route path="/instructor" element={<InstructorLayout />}>
            <Route index element={<HomePage />} />
            <Route path="schedule" element={<SchedulePage />} />
            <Route path="bookings" element={<InstructorBookingsPage />} />
            <Route path="bookings/:id" element={<InstructorBookingDetailPage />} />
            <Route path="clients" element={<ClientsPage />} />
            <Route path="clients/:id" element={<ClientDetailPage />} />
            <Route path="availability" element={<AvailabilityPage />} />
            <Route path="cash" element={<CashPage />} />
            <Route path="ratings" element={<InstructorRatingsPage />} />
            <Route path="notifications" element={<InstructorNotificationsPage />} />
            <Route path="profile" element={<InstructorProfilePage />} />
          </Route>
        </Route>
        <Route element={<RequireRole roles={ADMIN_ONLY} />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<OverviewPage />} />
            <Route path="bookings" element={<BookingsPage />} />
            <Route path="bookings/:id" element={<AdminBookingDetailPage />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="packages" element={<AdminPackagesPage />} />
            <Route path="ratings" element={<AdminRatingsPage />} />
            <Route path="instructors" element={<InstructorsPage />} />
            <Route path="branches" element={<BranchesPage />} />
            <Route path="admins" element={<AdminsPage />} />
            <Route path="audit-log" element={<AuditLogPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="settings/auto-complete" element={<AutoCompletePage />} />
            <Route path="notifications" element={<AdminNotificationsPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

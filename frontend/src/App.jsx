import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './layouts/AdminLayout';
import OwnerLayout from './layouts/OwnerLayout';
import LoginPage from './pages/LoginPage';
import AdminFeesPage from './pages/admin/AdminFeesPage';
import AdminPaymentsPage from './pages/admin/AdminPaymentsPage';
import AdminIncomesPage from './pages/admin/AdminIncomesPage';
import AdminFinesPage from './pages/admin/AdminFinesPage';
import AdminExpensesPage from './pages/admin/AdminExpensesPage';
import AdminReportsPage from './pages/admin/AdminReportsPage';
import AdminSettingsPage from './pages/admin/AdminSettingsPage';
import DepartmentsPage from './pages/admin/DepartmentsPage';
import OwnersDirectoryPage from './pages/admin/OwnersDirectoryPage';
import OwnerApartmentsPage from './pages/owner/OwnerApartmentsPage';
import OwnerAccountStatementPage from './pages/owner/OwnerAccountStatementPage';
import OwnerMonthlyBalancePage from './pages/owner/OwnerMonthlyBalancePage';
import OwnerPaymentsPage from './pages/owner/OwnerPaymentsPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminCamerasPage from './pages/admin/AdminCamerasPage';

// Nuevas páginas
import OwnerInicioPage from './pages/owner/OwnerInicioPage';
import OwnerCamerasPage from './pages/owner/OwnerCamerasPage';
import OwnerHelpPage from './pages/owner/OwnerHelpPage';
import OwnerProfilePage from './pages/owner/OwnerProfilePage';
import OwnerAnnouncementsPage from './pages/owner/OwnerAnnouncementsPage';
import AdminAnnouncementsPage from './pages/admin/AdminAnnouncementsPage';
import AdminEventsPage from './pages/admin/AdminEventsPage';
import PublicPdfValidationPage from './pages/PublicPdfValidationPage';

function RootRedirect() {
  const { role, loading } = useAuth();
  if (loading) return null;
  if (role === 'ADMIN') return <Navigate to="/admin/reports" replace />;
  if (role === 'PROPIETARIO') return <Navigate to="/owner/inicio" replace />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/validar-pdf/:token" element={<PublicPdfValidationPage />} />

      <Route
        path="/admin"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="reports" element={<AdminReportsPage />} />
        <Route path="settings" element={<AdminSettingsPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="owners" element={<OwnersDirectoryPage />} />
        <Route path="apartments" element={<DepartmentsPage />} />
        <Route path="fees" element={<AdminFeesPage />} />
        <Route path="payments" element={<AdminPaymentsPage />} />
        <Route path="incomes" element={<AdminIncomesPage />} />
        <Route path="fines" element={<AdminFinesPage />} />
        <Route path="expenses" element={<AdminExpensesPage />} />
        <Route path="announcements" element={<AdminAnnouncementsPage />} />
        <Route path="events" element={<AdminEventsPage />} />
        <Route path="cameras" element={<AdminCamerasPage />} />
        <Route index element={<Navigate to="reports" replace />} />
      </Route>

      <Route
        path="/owner"
        element={
          <ProtectedRoute requiredRole="PROPIETARIO">
            <OwnerLayout />
          </ProtectedRoute>
        }
      >
        <Route path="inicio" element={<OwnerInicioPage />} />
        <Route path="apartments" element={<OwnerApartmentsPage />} />
        <Route path="account-statement" element={<OwnerAccountStatementPage />} />
        <Route path="monthly-balance" element={<OwnerMonthlyBalancePage />} />
        <Route path="payments" element={<OwnerPaymentsPage />} />
        <Route path="announcements" element={<OwnerAnnouncementsPage />} />
        <Route path="cameras" element={<OwnerCamerasPage />} />
        <Route path="help" element={<OwnerHelpPage />} />
        <Route path="profile" element={<OwnerProfilePage />} />
        <Route index element={<Navigate to="inicio" replace />} />
      </Route>

      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

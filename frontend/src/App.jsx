import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './layouts/AdminLayout';
import OwnerLayout from './layouts/OwnerLayout';
import LoginPage from './pages/LoginPage';
import AdminFeesPage from './pages/admin/AdminFeesPage';
import AdminPaymentsPage from './pages/admin/AdminPaymentsPage';
import AdminFinesPage from './pages/admin/AdminFinesPage';
import AdminExpensesPage from './pages/admin/AdminExpensesPage';
import AdminReportsPage from './pages/admin/AdminReportsPage';
import DepartmentsPage from './pages/admin/DepartmentsPage';
import OwnersDirectoryPage from './pages/admin/OwnersDirectoryPage';
import OwnerApartmentsPage from './pages/owner/OwnerApartmentsPage';
import OwnerAccountStatementPage from './pages/owner/OwnerAccountStatementPage';
import OwnerMonthlyBalancePage from './pages/owner/OwnerMonthlyBalancePage';
import OwnerPaymentsPage from './pages/owner/OwnerPaymentsPage';

function RootRedirect() {
  const { role, loading } = useAuth();
  if (loading) return null;
  if (role === 'ADMIN') return <Navigate to="/admin/reports" replace />;
  if (role === 'PROPIETARIO') return <Navigate to="/owner/apartments" replace />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/admin"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="reports" element={<AdminReportsPage />} />
        <Route path="owners" element={<OwnersDirectoryPage />} />
        <Route path="apartments" element={<DepartmentsPage />} />
        <Route path="fees" element={<AdminFeesPage />} />
        <Route path="payments" element={<AdminPaymentsPage />} />
        <Route path="fines" element={<AdminFinesPage />} />
        <Route path="expenses" element={<AdminExpensesPage />} />
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
        <Route path="apartments" element={<OwnerApartmentsPage />} />
        <Route path="account-statement" element={<OwnerAccountStatementPage />} />
        <Route path="monthly-balance" element={<OwnerMonthlyBalancePage />} />
        <Route path="payments" element={<OwnerPaymentsPage />} />
        <Route index element={<Navigate to="apartments" replace />} />
      </Route>

      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

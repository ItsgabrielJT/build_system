import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './layouts/AdminLayout';
import OwnerLayout from './layouts/OwnerLayout';
import LoginPage from './pages/LoginPage';
import AdminOwnersPage from './pages/admin/AdminOwnersPage';
import AdminApartmentsPage from './pages/admin/AdminApartmentsPage';
import AdminFeesPage from './pages/admin/AdminFeesPage';
import AdminPaymentsPage from './pages/admin/AdminPaymentsPage';
import AdminFinesPage from './pages/admin/AdminFinesPage';
import AdminExpensesPage from './pages/admin/AdminExpensesPage';
import AdminDelinquencyPage from './pages/admin/AdminDelinquencyPage';
import AdminReportsPage from './pages/admin/AdminReportsPage';
import OwnerApartmentsPage from './pages/owner/OwnerApartmentsPage';
import OwnerAccountStatementPage from './pages/owner/OwnerAccountStatementPage';

function RootRedirect() {
  const { role, loading } = useAuth();
  if (loading) return null;
  if (role === 'ADMIN') return <Navigate to="/admin/owners" replace />;
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
        <Route path="owners" element={<AdminOwnersPage />} />
        <Route path="apartments" element={<AdminApartmentsPage />} />
        <Route path="fees" element={<AdminFeesPage />} />
        <Route path="payments" element={<AdminPaymentsPage />} />
        <Route path="fines" element={<AdminFinesPage />} />
        <Route path="expenses" element={<AdminExpensesPage />} />
        <Route path="delinquency" element={<AdminDelinquencyPage />} />
        <Route path="reports" element={<AdminReportsPage />} />
        <Route index element={<Navigate to="owners" replace />} />
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
        <Route index element={<Navigate to="apartments" replace />} />
      </Route>

      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

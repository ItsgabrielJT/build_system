import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import ForcePasswordChange from './ForcePasswordChange';

export default function ProtectedRoute({ children, requiredRole }) {
  const { isAuthenticated, user, role, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
        }}
      >
        <p>Cargando...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.password_is_temp) {
    return <ForcePasswordChange />;
  }

  if (requiredRole && role !== requiredRole) {
    if (role === 'ADMIN') return <Navigate to="/admin/reports" replace />;
    if (role === 'PROPIETARIO') return <Navigate to="/owner/apartments" replace />;
    return <Navigate to="/login" replace />;
  }

  return children;
}

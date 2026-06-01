import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { getAdminPaymentNotifications } from '../services/notificationService';

export function useAdminNotifications() {
  const { token, role } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchNotifications = useCallback(async () => {
    if (role !== 'ADMIN' || !token) {
      setNotifications([]);
      setTotal(0);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await getAdminPaymentNotifications(token);
      setNotifications(response.data || []);
      setTotal(response.total || 0);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al cargar notificaciones');
    } finally {
      setLoading(false);
    }
  }, [role, token]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return {
    notifications,
    total,
    loading,
    error,
    fetchNotifications,
    enabled: role === 'ADMIN',
  };
}
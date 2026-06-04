import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import {
  getAdminPaymentNotifications,
  getOwnerPaymentNotifications,
  markNotificationAsRead,
} from '../services/notificationService';

export function useAdminNotifications() {
  const { token, role } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchNotifications = useCallback(async () => {
    if (!token || !['ADMIN', 'PROPIETARIO'].includes(role)) {
      setNotifications([]);
      setTotal(0);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = role === 'ADMIN'
        ? await getAdminPaymentNotifications(token)
        : await getOwnerPaymentNotifications(token);
      setNotifications(response.data || []);
      setTotal(response.total || 0);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al cargar notificaciones');
    } finally {
      setLoading(false);
    }
  }, [role, token]);

  const markAsRead = useCallback(async (notificationId) => {
    if (!token) return;
    try {
      await markNotificationAsRead(token, notificationId, role === 'ADMIN');
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error al marcar notificación como leída:', err);
    }
  }, [token, role]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return {
    notifications,
    total,
    loading,
    error,
    fetchNotifications,
    markAsRead,
    enabled: ['ADMIN', 'PROPIETARIO'].includes(role),
  };
}
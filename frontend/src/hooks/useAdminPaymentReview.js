import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import * as paymentService from '../services/paymentService';

export function useAdminPaymentReview() {
  const { token } = useAuth();
  const [pendingPayments, setPendingPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchPending = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await paymentService.getPendingPayments(token);
      setPendingPayments(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al cargar pagos pendientes');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const approvePayment = useCallback(
    async (paymentId) => {
      const updated = await paymentService.approvePayment(paymentId, token);
      setPendingPayments((prev) => prev.filter((p) => p.id !== paymentId));
      return updated;
    },
    [token]
  );

  const rejectPayment = useCallback(
    async (paymentId, reason) => {
      const updated = await paymentService.rejectPayment(paymentId, { reason }, token);
      setPendingPayments((prev) => prev.filter((p) => p.id !== paymentId));
      return updated;
    },
    [token]
  );

  const downloadProof = useCallback(
    async (paymentId) => paymentService.downloadAdminPaymentProof(paymentId, token),
    [token]
  );

  return {
    pendingPayments,
    loading,
    error,
    fetchPending,
    approvePayment,
    rejectPayment,
    downloadProof,
  };
}

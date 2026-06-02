import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import * as paymentService from '../services/paymentService';

export function usePayments() {
  const { token } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchPayments = useCallback(
    async (params = {}) => {
      setLoading(true);
      setError(null);
      try {
        const data = await paymentService.getPayments(token, params);
        setPayments(data);
      } catch (err) {
        setError(err.response?.data?.detail || 'Error al cargar pagos');
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  const createPayment = useCallback(
    async (data) => {
      const created = await paymentService.createPayment(data, token);
      setPayments((prev) => [...prev, created]);
      return created;
    },
    [token]
  );

  const annulPayment = useCallback(
    async (paymentId) => {
      const updated = await paymentService.annulPayment(paymentId, token);
      setPayments((prev) => prev.map((p) => (p.id === paymentId ? updated : p)));
      return updated;
    },
    [token]
  );

  const downloadAdminProof = useCallback(
    async (paymentId) => paymentService.downloadAdminPaymentProof(paymentId, token),
    [token]
  );

  const downloadAdminReceipt = useCallback(
    async (paymentId) => paymentService.downloadAdminPaymentReceipt(paymentId, token),
    [token]
  );

  const downloadAdminAcknowledgement = useCallback(
    async (paymentId) => paymentService.downloadAdminPaymentAcknowledgement(paymentId, token),
    [token]
  );

  return { 
    payments, 
    loading, 
    error, 
    fetchPayments, 
    createPayment, 
    annulPayment,
    downloadAdminProof,
    downloadAdminReceipt,
    downloadAdminAcknowledgement
  };
}

import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import * as paymentService from '../services/paymentService';

export function useOwnerPayments() {
  const { token } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(
    async (filters = {}) => {
      setLoading(true);
      setError(null);
      try {
        const data = await paymentService.getOwnerPayments(filters, token);
        setPayments(data);
      } catch (err) {
        setError(err.response?.data?.detail || 'Error al cargar pagos');
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  const submitPayment = useCallback(
    async (formData) => {
      const created = await paymentService.submitOwnerPayment(formData, token);
      setPayments((prev) => [created, ...prev]);
      return created;
    },
    [token]
  );

  const downloadAcknowledgement = useCallback(
    async (paymentId, fileName) => {
      const blob = await paymentService.downloadPaymentAcknowledgement(paymentId, token);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName || `constancia-${paymentId}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    },
    [token]
  );

  const downloadReceipt = useCallback(
    async (paymentId, fileName) => {
      const blob = await paymentService.downloadPaymentReceipt(paymentId, token);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName || `recibo-${paymentId}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    },
    [token]
  );

  return {
    payments,
    loading,
    error,
    submitPayment,
    reload,
    downloadAcknowledgement,
    downloadReceipt,
  };
}

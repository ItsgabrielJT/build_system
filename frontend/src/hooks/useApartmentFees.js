import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import * as feeService from '../services/apartmentFeeService';

export function useApartmentFees() {
  const { token } = useAuth();
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchFees = useCallback(
    async (period) => {
      setLoading(true);
      setError(null);
      try {
        const data = await feeService.getFeesByPeriod(token, period);
        setFees(data);
      } catch (err) {
        setError(err.response?.data?.detail || 'Error al cargar cuotas');
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  const createFee = useCallback(
    async (data) => {
      const created = await feeService.createFee(data, token);
      setFees((prev) => [...prev, created]);
      return created;
    },
    [token]
  );

  const bulkUpload = useCallback(
    async (data) => {
      return feeService.bulkUploadFees(data, token);
    },
    [token]
  );

  const deleteFee = useCallback(
    async (feeId) => {
      setError(null);
      try {
        await feeService.deleteFee(feeId, token);
        setFees((prev) => prev.filter((f) => f.id !== feeId));
      } catch (err) {
        setError(err.response?.data?.detail || 'Error al eliminar cuota');
        throw err;
      }
    },
    [token]
  );

  const bulkDelete = useCallback(
    async (feeIds) => {
      setError(null);
      try {
        await feeService.bulkDeleteFees(feeIds, token);
        setFees((prev) => prev.filter((f) => !feeIds.includes(f.id)));
      } catch (err) {
        setError(err.response?.data?.detail || 'Error al eliminar cuotas');
        throw err;
      }
    },
    [token]
  );

  return { fees, loading, error, fetchFees, createFee, bulkUpload, deleteFee, bulkDelete };
}

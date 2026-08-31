import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import * as otherChargeService from '../services/otherChargeService';

export function useOtherCharges() {
  const { token } = useAuth();
  const [charges, setCharges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchCharges = useCallback(
    async (period, periodicity = '') => {
      setLoading(true);
      setError(null);
      try {
        const data = await otherChargeService.getOtherChargesByPeriod(token, period, periodicity);
        setCharges(data);
      } catch (err) {
        setError(err.response?.data?.detail || 'Error al cargar cobros');
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  const createCharge = useCallback(
    async (data) => {
      const created = await otherChargeService.createOtherCharge(data, token);
      setCharges((prev) => [...prev, created]);
      return created;
    },
    [token]
  );

  const bulkUpload = useCallback(
    async (data) => otherChargeService.bulkUploadOtherCharges(data, token),
    [token]
  );

  const deleteCharge = useCallback(
    async (chargeId) => {
      setError(null);
      try {
        await otherChargeService.deleteOtherCharge(chargeId, token);
        setCharges((prev) => prev.filter((c) => c.id !== chargeId));
      } catch (err) {
        setError(err.response?.data?.detail || 'Error al eliminar cobro');
        throw err;
      }
    },
    [token]
  );

  const bulkDelete = useCallback(
    async (chargeIds) => {
      setError(null);
      try {
        await otherChargeService.bulkDeleteOtherCharges(chargeIds, token);
        setCharges((prev) => prev.filter((c) => !chargeIds.includes(c.id)));
      } catch (err) {
        setError(err.response?.data?.detail || 'Error al eliminar cobros');
        throw err;
      }
    },
    [token]
  );

  return { charges, loading, error, fetchCharges, createCharge, bulkUpload, deleteCharge, bulkDelete };
}

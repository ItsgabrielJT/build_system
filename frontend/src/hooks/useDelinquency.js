import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import * as delinquencyService from '../services/delinquencyService';

export function useDelinquency() {
  const { token } = useAuth();
  const [delinquentOwners, setDelinquentOwners] = useState([]);
  const [delinquencyStats, setDelinquencyStats] = useState(null);
  const [ownerDetail, setOwnerDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchDelinquentOwners = useCallback(
    async (params = {}) => {
      setLoading(true);
      setError(null);
      try {
        const data = await delinquencyService.getDelinquentOwners(token, params);
        setDelinquentOwners(data);
      } catch (err) {
        setError(err.response?.data?.detail || 'Error al cargar morosos');
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  const fetchOwnerDetail = useCallback(
    async (ownerId) => {
      setLoading(true);
      setError(null);
      try {
        const data = await delinquencyService.getOwnerDelinquencyDetail(token, ownerId);
        setOwnerDetail(data);
        return data;
      } catch (err) {
        setError(err.response?.data?.detail || 'Error al cargar detalle');
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  const fetchDelinquencyStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await delinquencyService.getDelinquencyStats(token);
      setDelinquencyStats(data);
      return data;
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al cargar estadísticas de morosidad');
    } finally {
      setLoading(false);
    }
  }, [token]);

  return {
    delinquentOwners,
    delinquencyStats,
    ownerDetail,
    loading,
    error,
    fetchDelinquentOwners,
    fetchOwnerDetail,
    fetchDelinquencyStats,
  };
}

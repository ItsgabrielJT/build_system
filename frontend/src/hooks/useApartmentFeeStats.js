import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import { getApartmentFeeStats } from '../services/apartmentFeeService';

export function useApartmentFeeStats() {
  const { token } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchStats = useCallback(async (period) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getApartmentFeeStats(period, token);
      setStats(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al cargar estadísticas');
    } finally {
      setLoading(false);
    }
  }, [token]);

  return { stats, loading, error, fetchStats };
}

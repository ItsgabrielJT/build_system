import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import { getPeriodsSummary } from '../services/apartmentFeeService';

export function usePeriodsSummary() {
  const { token } = useAuth();
  const [periods, setPeriods] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [year, setYear] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchPeriods = useCallback(async (p = 1, ps = 10, y = null) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPeriodsSummary(p, ps, y, token);
      setPeriods(data.items ?? (Array.isArray(data) ? data : []));
      setTotal(data.total ?? (Array.isArray(data) ? data.length : 0));
      setPage(p);
      setYear(y);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al cargar períodos');
    } finally {
      setLoading(false);
    }
  }, [token]);

  return { periods, total, page, pageSize, year, loading, error, fetchPeriods };
}

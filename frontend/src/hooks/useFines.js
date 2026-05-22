import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import * as fineService from '../services/fineService';

export function useFines() {
  const { token } = useAuth();
  const [fines, setFines] = useState([]);
  const [fineStats, setFineStats] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, page_size: 10, total: 0, total_pages: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchFines = useCallback(
    async (params = {}) => {
      setLoading(true);
      setError(null);
      try {
        const data = await fineService.getFines(token, params);
        if (Array.isArray(data)) {
          setFines(data);
          setPagination({ page: 1, page_size: data.length || 10, total: data.length, total_pages: 1 });
        } else {
          setFines(data.items || []);
          setPagination({
            page: data.page || 1,
            page_size: data.page_size || params.page_size || 10,
            total: data.total || 0,
            total_pages: data.total_pages || 1,
          });
        }
      } catch (err) {
        setError(err.response?.data?.detail || 'Error al cargar multas');
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  const fetchFineStats = useCallback(
    async (params = {}) => {
      try {
        const data = await fineService.getFineStats(token, params);
        setFineStats(data);
        return data;
      } catch (err) {
        setError(err.response?.data?.detail || 'Error al cargar estadísticas de multas');
        return null;
      }
    },
    [token]
  );

  const createFine = useCallback(
    async (data) => {
      const created = await fineService.createFine(data, token);
      setFines((prev) => [...prev, created]);
      return created;
    },
    [token]
  );

  const annulFine = useCallback(
    async (fineId) => {
      const updated = await fineService.annulFine(fineId, token);
      setFines((prev) => prev.map((f) => (f.id === fineId ? updated : f)));
      return updated;
    },
    [token]
  );

  return { fines, fineStats, pagination, loading, error, fetchFines, fetchFineStats, createFine, annulFine };
}

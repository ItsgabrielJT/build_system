import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import * as fineService from '../services/fineService';

export function useFines() {
  const { token } = useAuth();
  const [fines, setFines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchFines = useCallback(
    async (params = {}) => {
      setLoading(true);
      setError(null);
      try {
        const data = await fineService.getFines(token, params);
        setFines(data);
      } catch (err) {
        setError(err.response?.data?.detail || 'Error al cargar multas');
      } finally {
        setLoading(false);
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

  return { fines, loading, error, fetchFines, createFine, annulFine };
}

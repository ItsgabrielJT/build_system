import { useCallback, useState } from 'react';
import { useAuth } from './useAuth';
import * as incomeService from '../services/incomeService';

export function useIncomes() {
  const { token } = useAuth();
  const [incomes, setIncomes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchIncomes = useCallback(
    async (params = {}) => {
      setLoading(true);
      setError(null);
      try {
        const data = await incomeService.getIncomes(token, params);
        setIncomes(data);
      } catch (err) {
        setError(err.response?.data?.detail || 'Error al cargar ingresos');
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  const createIncome = useCallback(
    async (data) => {
      const created = await incomeService.createIncome(data, token);
      setIncomes((prev) => [created, ...prev]);
      return created;
    },
    [token]
  );

  const annulIncome = useCallback(
    async (incomeId) => {
      const updated = await incomeService.annulIncome(incomeId, token);
      setIncomes((prev) => prev.map((income) => (income.id === incomeId ? updated : income)));
      return updated;
    },
    [token]
  );

  return { incomes, loading, error, fetchIncomes, createIncome, annulIncome };
}

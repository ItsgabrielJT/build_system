import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import * as expenseService from '../services/expenseService';

export function useExpenses() {
  const { token } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchExpenses = useCallback(
    async (month) => {
      setLoading(true);
      setError(null);
      try {
        const data = await expenseService.getExpensesByMonth(token, month);
        setExpenses(Array.isArray(data) ? data : data.items || []);
        setTotal(data.total || 0);
      } catch (err) {
        setError(err.response?.data?.detail || 'Error al cargar gastos');
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  const createExpense = useCallback(
    async (data) => {
      const created = await expenseService.createExpense(data, token);
      setExpenses((prev) => [...prev, created]);
      return created;
    },
    [token]
  );

  return { expenses, total, loading, error, fetchExpenses, createExpense };
}

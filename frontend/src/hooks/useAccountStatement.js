import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import * as accountStatementService from '../services/accountStatementService';

export function useAccountStatement() {
  const { token } = useAuth();
  const [statement, setStatement] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  const fetchStatement = useCallback(
    async (params = {}) => {
      setLoading(true);
      setError(null);
      try {
        const data = await accountStatementService.getAccountStatement(token, params);
        setStatement(data);
      } catch (err) {
        setError(err.response?.data?.detail || 'Error al cargar estado de cuenta');
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  const exportStatement = useCallback(
    async (format, params = {}, filename) => {
      setExporting(true);
      try {
        const blob = await accountStatementService.exportAccountStatement(token, format, params);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || `estado-cuenta.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        setError(err.response?.data?.detail || 'Error al exportar');
      } finally {
        setExporting(false);
      }
    },
    [token]
  );

  return { statement, loading, exporting, error, fetchStatement, exportStatement };
}

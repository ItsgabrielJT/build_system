import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import * as accountStatementService from '../services/accountStatementService';

export function useAccountStatement() {
  const { token } = useAuth();
  const [statement, setStatement] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exportingFormat, setExportingFormat] = useState(null);
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
    async (format, params = {}) => {
      setExportingFormat(format);
      setError(null);
      try {
        return await accountStatementService.exportAccountStatement(token, format, params);
      } catch (err) {
        setError(err.response?.data?.detail || 'Error al exportar');
        return null;
      } finally {
        setExportingFormat(null);
      }
    },
    [token]
  );

  return {
    statement,
    loading,
    exporting: Boolean(exportingFormat),
    exportingFormat,
    error,
    fetchStatement,
    exportStatement,
  };
}

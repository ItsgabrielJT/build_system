import { useEffect, useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import * as reportService from '../services/reportService';

function getServiceForRole(role) {
  return role === 'PROPIETARIO'
    ? reportService.getOwnerMonthlyBalance
    : reportService.getAdminMonthlyBalance;
}

export function useMonthlyBalance(role, periodOrParams) {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const paramsKey = typeof periodOrParams === 'string'
    ? periodOrParams
    : JSON.stringify(periodOrParams);

  const reload = useCallback(async () => {
    if (!token || !role) {
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const service = getServiceForRole(role);
      const response = await service(periodOrParams, token);
      setData(response);
      return response;
    } catch (err) {
      const message = err.response?.data?.detail || 'Error al cargar balance mensual';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [paramsKey, role, token]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload };
}
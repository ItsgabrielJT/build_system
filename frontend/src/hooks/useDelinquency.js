import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import * as delinquencyService from '../services/delinquencyService';

export function useDelinquency() {
  const { token } = useAuth();
  const [delinquentOwners, setDelinquentOwners] = useState([]);
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

  return { delinquentOwners, ownerDetail, loading, error, fetchDelinquentOwners, fetchOwnerDetail };
}

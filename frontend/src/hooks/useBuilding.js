import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import * as buildingService from '../services/buildingService';

export function useBuilding() {
  const { token } = useAuth();
  const [building, setBuilding] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchBuilding = useCallback(
    async (buildingId) => {
      setLoading(true);
      setError(null);
      try {
        const data = await buildingService.getBuilding(token, buildingId);
        setBuilding(data);
        return data;
      } catch (err) {
        setError(err.response?.data?.detail || 'Error al cargar información del edificio');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  const updateBuilding = useCallback(
    async (buildingId, data) => {
      setLoading(true);
      setError(null);
      try {
        const updated = await buildingService.updateBuilding(buildingId, data, token);
        setBuilding(updated);
        return updated;
      } catch (err) {
        setError(err.response?.data?.detail || 'Error al actualizar información del edificio');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  return {
    building,
    loading,
    error,
    fetchBuilding,
    updateBuilding,
  };
}

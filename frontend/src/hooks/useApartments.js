import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import * as apartmentService from '../services/apartmentService';

export function useApartments() {
  const { token } = useAuth();
  const [apartments, setApartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchApartments = useCallback(
    async (params = {}) => {
      setLoading(true);
      setError(null);
      try {
        const data = await apartmentService.getApartments(token, params);
        setApartments(data);
      } catch (err) {
        setError(err.response?.data?.detail || 'Error al cargar departamentos');
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  const createApartment = useCallback(
    async (data) => {
      const created = await apartmentService.createApartment(data, token);
      setApartments((prev) => [...prev, created]);
      return created;
    },
    [token]
  );

  const updateApartment = useCallback(
    async (apartmentId, data) => {
      const updated = await apartmentService.updateApartment(apartmentId, data, token);
      setApartments((prev) => prev.map((a) => (a.id === apartmentId ? updated : a)));
      return updated;
    },
    [token]
  );

  const assignOwner = useCallback(
    async (apartmentId, ownerId, data = {}) => {
      return apartmentService.assignOwner(apartmentId, ownerId, data, token);
    },
    [token]
  );

  const removeOwner = useCallback(
    async (apartmentId, ownerId) => {
      return apartmentService.removeOwner(apartmentId, ownerId, token);
    },
    [token]
  );

  return {
    apartments,
    loading,
    error,
    fetchApartments,
    createApartment,
    updateApartment,
    assignOwner,
    removeOwner,
  };
}

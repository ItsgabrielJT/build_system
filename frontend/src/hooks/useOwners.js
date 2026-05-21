import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import * as ownerService from '../services/ownerService';

export function useOwners() {
  const { token } = useAuth();
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchOwners = useCallback(
    async (params = {}) => {
      setLoading(true);
      setError(null);
      try {
        const data = await ownerService.getOwners(token, params);
        setOwners(data);
      } catch (err) {
        setError(err.response?.data?.detail || 'Error al cargar propietarios');
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  const createOwner = useCallback(
    async (data) => {
      const created = await ownerService.createOwner(data, token);
      setOwners((prev) => [...prev, created]);
      return created;
    },
    [token]
  );

  const updateOwner = useCallback(
    async (ownerId, data) => {
      const updated = await ownerService.updateOwner(ownerId, data, token);
      setOwners((prev) => prev.map((o) => (o.id === ownerId ? updated : o)));
      return updated;
    },
    [token]
  );

  const deleteOwner = useCallback(
    async (ownerId) => {
      await ownerService.deleteOwner(ownerId, token);
      setOwners((prev) => prev.filter((o) => o.id !== ownerId));
    },
    [token]
  );

  return { owners, loading, error, fetchOwners, createOwner, updateOwner, deleteOwner };
}

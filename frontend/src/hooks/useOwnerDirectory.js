import { useState, useCallback, useEffect } from 'react';
import { useAuth } from './useAuth';
import * as ownerService from '../services/ownerService';

export function useOwnerDirectory() {
  const { token } = useAuth();
  const [owners, setOwners] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedOwner, setSelectedOwner] = useState(null);

  const itemsPerPage = 10;
  const debounceDelay = 300;
  const [debounceTimer, setDebounceTimer] = useState(null);

  const fetchOwners = useCallback(
    async (page = 1, search = '') => {
      setLoading(true);
      setError(null);
      try {
        const params = {
          page,
          per_page: itemsPerPage,
        };

        if (search.trim()) {
          params.search = search.trim();
        }

        const data = await ownerService.getOwnerDirectory(token, params);
        setOwners(data.items || data);
        setCurrentPage(data.page || page);
        setTotalPages(data.total_pages || 1);
        setTotal(data.total || 0);
      } catch (err) {
        setError(err.response?.data?.detail || 'Error al cargar propietarios');
        setOwners([]);
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  const handleSearchChange = useCallback(
    (value) => {
      setSearchTerm(value);

      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      const timer = setTimeout(() => {
        setCurrentPage(1);
        fetchOwners(1, value);
      }, debounceDelay);

      setDebounceTimer(timer);
    },
    [debounceTimer, fetchOwners]
  );

  const handlePageChange = useCallback(
    (page) => {
      setCurrentPage(page);
      fetchOwners(page, searchTerm);
    },
    [searchTerm, fetchOwners]
  );

  const handleSelectOwner = useCallback((owner) => {
    setSelectedOwner(owner);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedOwner(null);
  }, []);

  useEffect(() => {
    if (!token) return;
    fetchOwners(1, searchTerm);
  }, [token, fetchOwners, searchTerm]);

  return {
    owners,
    currentPage,
    totalPages,
    total,
    searchTerm,
    loading,
    error,
    itemsPerPage,
    selectedOwner,
    onSearchChange: handleSearchChange,
    onPageChange: handlePageChange,
    onSelectOwner: handleSelectOwner,
    onCloseModal: handleCloseModal,
  };
}

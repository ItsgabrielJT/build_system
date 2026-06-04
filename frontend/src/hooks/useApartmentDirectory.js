import { useState, useCallback, useEffect } from 'react';
import { useAuth } from './useAuth';
import { useNotification } from '../context/NotificationContext';
import * as apartmentService from '../services/apartmentService';
import { getBuildings } from '../services/buildingService';

export function useApartmentDirectory() {
  const { token } = useAuth();
  const { success, error: toastError } = useNotification();
  const [statistics, setStatistics] = useState(null);
  const [apartments, setApartments] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('TODOS');
  const [buildingFilter, setBuildingFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [buildings, setBuildings] = useState([]);

  const itemsPerPage = 4;

  const fetchStatistics = useCallback(async (buildingId = buildingFilter) => {
    try {
      const data = await apartmentService.getApartmentStatistics(token, buildingId ? { building_id: buildingId } : {});
      setStatistics(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al cargar estadísticas');
    }
  }, [token, buildingFilter]);

  const fetchBuildings = useCallback(async () => {
    try {
      const data = await getBuildings(token);
      setBuildings(Array.isArray(data) ? data : []);
    } catch {
      setBuildings([]);
    }
  }, [token]);

  const fetchApartments = useCallback(
    async (page = 1, filterStatus = null) => {
      setLoading(true);
      setError(null);
      try {
        const params = {
          page,
          per_page: itemsPerPage,
        };

        if (filterStatus && filterStatus !== 'TODOS') {
          params.status = filterStatus;
        }

        if (buildingFilter) {
          params.building_id = buildingFilter;
        }

        const data = await apartmentService.getApartmentDirectory(token, params);
        setApartments(data.items || data);
        setCurrentPage(data.page || page);
        setTotalPages(data.total_pages || 1);
        setTotal(data.total || 0);
      } catch (err) {
        setError(err.response?.data?.detail || 'Error al cargar departamentos');
        setApartments([]);
      } finally {
        setLoading(false);
      }
    },
    [token, buildingFilter]
  );

  const handleFilterChange = useCallback(
    (newFilter) => {
      setFilter(newFilter);
      setCurrentPage(1);
      fetchApartments(1, newFilter);
    },
    [fetchApartments]
  );

  const handlePageChange = useCallback(
    (page) => {
      setCurrentPage(page);
      fetchApartments(page, filter);
    },
    [filter, fetchApartments]
  );

  const handleBuildingFilterChange = useCallback(
    (buildingId) => {
      setBuildingFilter(buildingId);
      setCurrentPage(1);
    },
    []
  );

  const handleCreateApartment = useCallback(
    async (formData) => {
      try {
        const payload = {
          code: formData.code,
          floor: formData.floor ? parseInt(formData.floor, 10) : undefined,
          tower: formData.tower || undefined,
          building_id: formData.building_id || undefined,
        };
        await apartmentService.createApartment(payload, token);
        success('Apartamento creado con éxito');
        setShowCreateModal(false);
        fetchStatistics(buildingFilter);
        fetchApartments(1, filter);
      } catch (err) {
        toastError(err.response?.data?.detail || 'Error al crear apartamento');
      }
    },
    [token, fetchStatistics, fetchApartments, filter, buildingFilter, success, toastError]
  );

  useEffect(() => {
    if (!token) return;
    fetchStatistics(buildingFilter);
    fetchApartments(1, filter);
    fetchBuildings();
  }, [token, fetchStatistics, fetchApartments, fetchBuildings, filter, buildingFilter]);

  return {
    statistics,
    apartments,
    currentPage,
    totalPages,
    total,
    filter,
    buildingFilter,
    loading,
    error,
    itemsPerPage,
    showCreateModal,
    buildings,
    onFilterChange: handleFilterChange,
    onBuildingFilterChange: handleBuildingFilterChange,
    onPageChange: handlePageChange,
    onOpenCreateModal: () => setShowCreateModal(true),
    onCloseCreateModal: () => setShowCreateModal(false),
    onCreateApartment: handleCreateApartment,
    onRefresh: () => { fetchStatistics(buildingFilter); fetchApartments(1, filter); },
  };
}

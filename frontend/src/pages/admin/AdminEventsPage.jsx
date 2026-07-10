import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { createEvent, deleteEvent, getEvents, updateEvent } from '../../services/eventService';
import { getOwners } from '../../services/ownerService';
import FormModal from '../../components/FormModal/FormModal';
import { useNotification } from '../../context/NotificationContext';
import styles from './AdminEventsPage.module.css';

const PAGE_SIZE = 5;

const formatDate = (value) => {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`));
};

export default function AdminEventsPage() {
  const { token } = useAuth();
  const { success, error: toastError } = useNotification();

  const [events, setEvents] = useState([]);
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [query, setQuery] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    async function loadData() {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const [eventsData, ownersData] = await Promise.all([
          getEvents(token),
          getOwners(token),
        ]);
        setEvents(eventsData);
        setOwners(ownersData);
      } catch (err) {
        setError(err.response?.data?.detail || 'Error al cargar los datos');
        toastError(err.response?.data?.detail || 'Error al cargar los datos');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [token]);

  const loadEventsOnly = async () => {
    try {
      const data = await getEvents(token);
      setEvents(data);
    } catch (err) {
      toastError(err.response?.data?.detail || 'Error al actualizar eventos');
    }
  };

  const visibleEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return events.filter((event) => {
      if (filterStartDate && event.event_date < filterStartDate) return false;
      if (filterEndDate && event.event_date > filterEndDate) return false;
      if (!normalizedQuery) return true;
      
      const ownerNames = (event.assigned_owners || [])
        .map((owner) => owner.full_name)
        .join(' ')
        .toLowerCase();

      return [
        event.title,
        event.description,
        event.event_date,
        event.start_time,
        event.end_time,
        ownerNames,
      ].some((value) => String(value || '').toLowerCase().includes(normalizedQuery));
    });
  }, [events, query, filterStartDate, filterEndDate]);

  const paginatedVisibleEvents = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return visibleEvents.slice(start, start + PAGE_SIZE);
  }, [page, visibleEvents]);

  const totalPages = Math.max(1, Math.ceil(visibleEvents.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [query, filterStartDate, filterEndDate]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const currentMonthStr = new Date().toISOString().slice(0, 7);

  const upcomingCount = useMemo(() => {
    return events.filter((e) => e.event_date && e.event_date >= todayStr).length;
  }, [events, todayStr]);

  const thisMonthCount = useMemo(() => {
    return events.filter((e) => e.event_date && e.event_date.startsWith(currentMonthStr)).length;
  }, [events, currentMonthStr]);

  const formFields = [
    { name: 'title', label: 'Título', type: 'text', required: true },
    { name: 'description', label: 'Descripción', type: 'textarea', required: true },
    { name: 'event_date', label: 'Fecha (Día)', type: 'date', required: true },
    { name: 'start_time', label: 'Hora de inicio (HH:MM)', type: 'text', required: true, placeholder: 'ej. 14:00' },
    { name: 'end_time', label: 'Hora de fin (HH:MM)', type: 'text', required: true, placeholder: 'ej. 16:00' },
    {
      name: 'owner_ids',
      label: 'Propietarios asignados',
      type: 'multiselect',
      required: true,
      options: owners.map((o) => ({ value: o.id, label: o.full_name })),
    },
  ];

  const openCreateModal = () => {
    setEditingEvent(null);
    setIsFormOpen(true);
  };

  const openEditModal = (event) => {
    setEditingEvent({
      ...event,
      owner_ids: (event.assigned_owners || []).map((owner) => owner.id),
    });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingEvent(null);
  };

  const handleSubmit = async (formData) => {
    try {
      if (editingEvent) {
        await updateEvent(editingEvent.id, formData, token);
        success('Evento actualizado con éxito');
      } else {
        await createEvent(formData, token);
        success('Evento creado con éxito');
      }
      closeForm();
      await loadEventsOnly();
    } catch (err) {
      toastError(err.response?.data?.detail || 'Error al guardar el evento');
      throw err;
    }
  };

  const handleDelete = async (event) => {
    const confirmed = window.confirm(`¿Eliminar el evento "${event.title}"?`);
    if (!confirmed) return;
    try {
      await deleteEvent(event.id, token);
      success('Evento eliminado con éxito');
      await loadEventsOnly();
    } catch (err) {
      toastError(err.response?.data?.detail || 'Error al eliminar el evento');
    }
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;
    return (
      <div className={styles.pagination} aria-label="Paginación de eventos">
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={() => setPage((p) => p - 1)}
          disabled={page === 1}
        >
          Anterior
        </button>
        <span className={styles.paginationInfo}>Página {page} de {totalPages}</span>
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={() => setPage((p) => p + 1)}
          disabled={page === totalPages}
        >
          Siguiente
        </button>
      </div>
    );
  };

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <div className={styles.breadcrumb}>Admin / Eventos</div>
          <h1 className={styles.title}>Gestión de Eventos</h1>
          <p className={styles.subtitle}>
            Organiza reuniones, mantenimientos y eventos de la comunidad con asignación directa a los propietarios.
          </p>
        </div>
        <div className={styles.headerActions}>
          <label className={styles.dateField}>
            <span>Inicio</span>
            <input type="date" value={filterStartDate} onChange={(event) => setFilterStartDate(event.target.value)} />
          </label>
          <label className={styles.dateField}>
            <span>Fin</span>
            <input type="date" value={filterEndDate} onChange={(event) => setFilterEndDate(event.target.value)} />
          </label>
          <button type="button" className={styles.btnPrimary} onClick={openCreateModal}>
            + Crear evento
          </button>
        </div>
      </section>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <section className={styles.metricsGrid}>
        <article className={styles.metricCard}>
          <div className={styles.metricTopline}>
            <span className={styles.iconCircle}>📋</span>
            <span className={styles.metricTag}>Histórico</span>
          </div>
          <span className={styles.metricLabel}>Total eventos</span>
          <strong className={styles.metricValue}>{events.length}</strong>
          <span className={styles.metricFoot}>Eventos en el sistema</span>
        </article>

        <article className={styles.metricCard}>
          <div className={styles.metricTopline}>
            <span className={styles.iconCircle}>📅</span>
            <span className={styles.metricTag}>Próximos</span>
          </div>
          <span className={styles.metricLabel}>Eventos futuros</span>
          <strong className={styles.metricValue}>{upcomingCount}</strong>
          <span className={styles.metricFoot}>Desde hoy en adelante</span>
        </article>

        <article className={styles.metricCard}>
          <div className={styles.metricTopline}>
            <span className={styles.iconCircle}>🗓️</span>
            <span className={styles.metricTag}>Mensual</span>
          </div>
          <span className={styles.metricLabel}>Este mes</span>
          <strong className={styles.metricValue}>{thisMonthCount}</strong>
          <span className={styles.metricFoot}>Eventos en el mes actual</span>
        </article>
      </section>

      <section className={styles.dashboardGrid}>
        <div className={styles.mainColumn}>
          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <h2>Lista de eventos</h2>
                <p>{visibleEvents.length} eventos según los filtros actuales.</p>
              </div>
              <input
                className={styles.searchInput}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por título, descripción u propietario..."
              />
            </div>

            {loading ? (
              <div className={styles.emptyState}>Cargando eventos...</div>
            ) : visibleEvents.length ? (
              <>
                <div className={styles.tableWrap}>
                  <table className={styles.eventsTable}>
                    <thead>
                      <tr>
                        <th>Evento / Detalle</th>
                        <th>Fecha</th>
                        <th>Horario</th>
                        <th>Propietarios Asignados</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedVisibleEvents.map((event) => (
                        <tr key={event.id}>
                          <td>
                            <strong>{event.title}</strong>
                            <span>{event.description}</span>
                          </td>
                          <td>
                            <strong>{formatDate(event.event_date)}</strong>
                          </td>
                          <td>
                            <strong>{event.start_time} - {event.end_time}</strong>
                          </td>
                          <td>
                            <div className={styles.ownerPillsContainer}>
                              {event.assigned_owners && event.assigned_owners.length > 0 ? (
                                event.assigned_owners.map((owner) => (
                                  <span key={owner.id} className={styles.ownerPill}>
                                    {owner.full_name}
                                  </span>
                                ))
                              ) : (
                                <span className={styles.emptyStateSmall} style={{ minHeight: 'auto', border: 0, padding: 0 }}>
                                  Sin propietarios asignados
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className={styles.rowActions}>
                              <button
                                type="button"
                                className={styles.btnEdit}
                                onClick={() => openEditModal(event)}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className={styles.btnTable}
                                onClick={() => handleDelete(event)}
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {renderPagination()}
              </>
            ) : (
              <div className={styles.emptyState}>No se encontraron eventos.</div>
            )}
          </article>
        </div>

        <aside className={styles.sideColumn}>
          <article className={styles.panel}>
            <h2>Resumen operativo</h2>
            <div className={styles.summaryRows}>
              <div>
                <span>Total eventos registrados</span>
                <strong>{events.length}</strong>
              </div>
              <div>
                <span>Eventos filtrados</span>
                <strong>{visibleEvents.length}</strong>
              </div>
              <div>
                <span>Eventos próximos</span>
                <strong>{upcomingCount}</strong>
              </div>
              <div>
                <span>Propietarios en sistema</span>
                <strong>{owners.length}</strong>
              </div>
            </div>
          </article>
        </aside>
      </section>

      <FormModal
        isOpen={isFormOpen}
        title={editingEvent ? 'Editar evento' : 'Crear nuevo evento'}
        fields={formFields}
        initialData={editingEvent || undefined}
        onSubmit={handleSubmit}
        onClose={closeForm}
      />
    </div>
  );
}

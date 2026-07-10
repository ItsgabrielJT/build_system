import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../context/NotificationContext';
import {
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncements,
  updateAnnouncement,
} from '../../services/announcementService';
import FormModal from '../../components/FormModal/FormModal';
import styles from './AdminAnnouncementsPage.module.css';

const PAGE_SIZE = 5;

const formatDate = (value) => {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  return new Intl.DateTimeFormat('es', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

const formatTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return new Intl.DateTimeFormat('es', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export default function AdminAnnouncementsPage() {
  const { token } = useAuth();
  const { success, error: toastError } = useNotification();
  
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [query, setQuery] = useState('');
  
  // Date filters
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  
  const [page, setPage] = useState(1);
  const [actionError, setActionError] = useState(null);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);

  const fetchAllAnnouncements = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAnnouncements(token);
      setAnnouncements(data);
    } catch (err) {
      const msg = err.response?.data?.detail || 'Error al obtener avisos';
      setError(msg);
      toastError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchAllAnnouncements();
    }
  }, [token]);

  // Reset page on filters change
  useEffect(() => {
    setPage(1);
  }, [filterStartDate, filterEndDate, query]);

  // Filtered announcements
  const visibleAnnouncements = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return announcements.filter((ann) => {
      // created_at is in TIMESTAMPTZ, slice the date part: YYYY-MM-DD
      const createdDate = ann.created_at ? ann.created_at.slice(0, 10) : '';
      
      if (filterStartDate && createdDate < filterStartDate) return false;
      if (filterEndDate && createdDate > filterEndDate) return false;
      
      if (!normalizedQuery) return true;
      
      return [
        ann.title,
        ann.description,
      ].some((val) => String(val || '').toLowerCase().includes(normalizedQuery));
    });
  }, [announcements, query, filterStartDate, filterEndDate]);

  // Paginated visible announcements
  const paginatedAnnouncements = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return visibleAnnouncements.slice(start, start + PAGE_SIZE);
  }, [page, visibleAnnouncements]);

  const totalPages = Math.max(1, Math.ceil(visibleAnnouncements.length / PAGE_SIZE));

  // Metrics calculations
  const totalCount = announcements.length;
  
  const thisMonthCount = useMemo(() => {
    const currentYearMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"
    return announcements.filter((ann) => ann.created_at && ann.created_at.startsWith(currentYearMonth)).length;
  }, [announcements]);

  const recentCount = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return announcements.filter((ann) => ann.created_at && new Date(ann.created_at) >= sevenDaysAgo).length;
  }, [announcements]);

  const openCreateModal = () => {
    setEditingAnnouncement(null);
    setIsFormOpen(true);
  };

  const openEditModal = (announcement) => {
    setEditingAnnouncement(announcement);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingAnnouncement(null);
  };

  const handleSubmit = async (formData) => {
    try {
      if (editingAnnouncement) {
        await updateAnnouncement(editingAnnouncement.id, formData, token);
        success('Aviso actualizado con éxito');
      } else {
        await createAnnouncement(formData, token);
        success('Aviso creado y difundido con éxito');
      }
      closeForm();
      await fetchAllAnnouncements();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Error al guardar el aviso';
      toastError(msg);
      throw err; // FormModal handles the error and stops submitting
    }
  };

  const handleDelete = async (announcement) => {
    const confirmed = window.confirm(`¿Eliminar el aviso "${announcement.title}"?`);
    if (!confirmed) return;
    try {
      await deleteAnnouncement(announcement.id, token);
      success('Aviso eliminado con éxito');
      await fetchAllAnnouncements();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Error al eliminar el aviso';
      setActionError(msg);
      toastError(msg);
    }
  };

  const getAnnouncementFields = () => {
    return [
      {
        name: 'title',
        label: 'Título del aviso',
        type: 'text',
        required: true,
        placeholder: 'Ej. Corte de agua programado o Asamblea extraordinaria',
      },
      {
        name: 'description',
        label: 'Descripción / Cuerpo del aviso',
        type: 'textarea',
        required: true,
        placeholder: 'Escriba el detalle del comunicado, incluyendo horarios, fechas y recomendaciones pertinentes.',
      },
    ];
  };

  const renderPagination = (currentPage, totalPagesCount, onPageChange, label) => {
    if (totalPagesCount <= 1) return null;

    return (
      <div className={styles.pagination} aria-label={`Paginación de ${label}`}>
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          Anterior
        </button>
        <span className={styles.paginationInfo}>Página {currentPage} de {totalPagesCount}</span>
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPagesCount}
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
          <div className={styles.breadcrumb}>Admin / Avisos</div>
          <h1 className={styles.title}>Gestión de Avisos</h1>
          <p className={styles.subtitle}>
            Publique y administre comunicados para mantener a los copropietarios informados sobre novedades, trabajos o eventos en el edificio.
          </p>
        </div>
        <div className={styles.headerActions}>
          <label className={styles.dateField}>
            <span>Desde</span>
            <input 
              type="date" 
              value={filterStartDate} 
              onChange={(e) => setFilterStartDate(e.target.value)} 
              aria-label="Fecha inicial"
            />
          </label>
          <label className={styles.dateField}>
            <span>Hasta</span>
            <input 
              type="date" 
              value={filterEndDate} 
              onChange={(e) => setFilterEndDate(e.target.value)} 
              aria-label="Fecha final"
            />
          </label>
          <button 
            type="button" 
            className={styles.btnPrimary} 
            onClick={openCreateModal}
          >
            + Publicar aviso
          </button>
        </div>
      </section>

      {(error || actionError) && (
        <div className={styles.errorBanner}>{error || actionError}</div>
      )}

      {/* Metrics Cards Grid */}
      <section className={styles.metricsGrid}>
        <article className={styles.metricCard}>
          <div className={styles.metricTopline}>
            <span className={styles.iconCircle}>📢</span>
            <span className={styles.metricTag}>Histórico</span>
          </div>
          <span className={styles.metricLabel}>Total avisos</span>
          <strong className={styles.metricValue}>{totalCount}</strong>
          <span className={styles.metricFoot}>Publicados en el sistema</span>
        </article>

        <article className={styles.metricCard}>
          <div className={styles.metricTopline}>
            <span className={styles.iconCircle}>📅</span>
            <span className={styles.metricTag}>Mensual</span>
          </div>
          <span className={styles.metricLabel}>Avisos de este mes</span>
          <strong className={styles.metricValue}>{thisMonthCount}</strong>
          <span className={styles.metricFoot}>Novedades en el mes actual</span>
        </article>

        <article className={`${styles.metricCard} ${styles.warningCard}`}>
          <div className={styles.metricTopline}>
            <span className={styles.iconCircle}>⚡</span>
            <span className={styles.metricTag}>Reciente</span>
          </div>
          <span className={styles.metricLabel}>Últimos 7 días</span>
          <strong className={styles.metricValue}>{recentCount}</strong>
          <span className={styles.metricFoot}>Nuevas publicaciones</span>
        </article>
      </section>

      {/* Main Grid: Listings + Side column */}
      <section className={styles.dashboardGrid}>
        <div className={styles.mainColumn}>
          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <h2>Lista de avisos</h2>
                <p>{visibleAnnouncements.length} avisos encontrados según los filtros actuales.</p>
              </div>
              <input
                className={styles.searchInput}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por título o descripción..."
                aria-label="Buscar aviso"
              />
            </div>

            {loading ? (
              <div className={styles.emptyState}>Cargando avisos...</div>
            ) : paginatedAnnouncements.length ? (
              <>
                <div className={styles.tableWrap}>
                  <table className={styles.paymentsTable}>
                    <thead>
                      <tr>
                        <th>Título</th>
                        <th>Descripción</th>
                        <th>Fecha de publicación</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedAnnouncements.map((ann) => (
                        <tr key={ann.id}>
                          <td style={{ verticalAlign: 'top', width: '30%' }}>
                            <strong>{ann.title}</strong>
                          </td>
                          <td style={{ verticalAlign: 'top', width: '50%' }}>
                            <span style={{ whiteSpace: 'pre-wrap', color: 'var(--color-gray-700)' }}>
                              {ann.description}
                            </span>
                          </td>
                          <td style={{ verticalAlign: 'top', width: '20%' }}>
                            <strong>{formatDate(ann.created_at)}</strong>
                            <span>{formatTime(ann.created_at)}</span>
                          </td>
                          <td style={{ verticalAlign: 'top', width: '18%' }}>
                            <div className={styles.rowActions}>
                              <button
                                type="button"
                                className={styles.btnEdit}
                                onClick={() => openEditModal(ann)}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className={styles.btnTable}
                                onClick={() => handleDelete(ann)}
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
                {renderPagination(page, totalPages, setPage, 'avisos')}
              </>
            ) : (
              <div className={styles.emptyState}>No hay avisos registrados.</div>
            )}
          </article>
        </div>

        <aside className={styles.sideColumn}>
          <article className={styles.panel}>
            <h2>Resumen operativo</h2>
            <div className={styles.summaryRows}>
              <div>
                <span>Total de avisos</span>
                <strong>{totalCount}</strong>
              </div>
              <div>
                <span>Este mes</span>
                <strong>{thisMonthCount}</strong>
              </div>
              <div>
                <span>Últimos 7 días</span>
                <strong>{recentCount}</strong>
              </div>
            </div>
          </article>
        </aside>
      </section>

      <FormModal
        isOpen={isFormOpen}
        title={editingAnnouncement ? 'Editar aviso' : 'Publicar nuevo aviso'}
        fields={getAnnouncementFields()}
        initialData={editingAnnouncement || undefined}
        onSubmit={handleSubmit}
        onClose={closeForm}
      />
    </div>
  );
}

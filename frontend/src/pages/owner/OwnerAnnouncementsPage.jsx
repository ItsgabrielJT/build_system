import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getOwnerAnnouncements } from '../../services/announcementService';
import { getMyEvents } from '../../services/eventService';
import { useNotification } from '../../context/NotificationContext';
import styles from './OwnerAnnouncementsPage.module.css';

const PAGE_SIZE = 5;

function formatDate(value) {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-EC', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}

function formatEventDate(event) {
  const dateLabel = formatDate(`${event.event_date}T00:00:00`);
  const start = event.start_time || 'Sin hora';
  const end = event.end_time ? ` - ${event.end_time}` : '';
  return `${dateLabel} · ${start}${end}`;
}

function buildItems(announcements, events) {
  const announcementItems = announcements.map((announcement) => ({
    ...announcement,
    type: 'announcement',
    badge: 'Aviso',
    dateLabel: formatDate(announcement.created_at),
    filterDate: announcement.created_at ? announcement.created_at.slice(0, 10) : '',
    sortDate: announcement.created_at || '',
  }));

  const eventItems = events.map((event) => ({
    ...event,
    type: 'event',
    badge: 'Evento',
    dateLabel: formatEventDate(event),
    filterDate: event.event_date || '',
    sortDate: event.event_date || '',
  }));

  return [...announcementItems, ...eventItems].sort((a, b) => {
    return new Date(b.sortDate || 0) - new Date(a.sortDate || 0);
  });
}

export default function OwnerAnnouncementsPage() {
  const { token } = useAuth();
  const { error: toastError } = useNotification();
  const [searchParams, setSearchParams] = useSearchParams();
  const [announcements, setAnnouncements] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [query, setQuery] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadItems = async () => {
      if (!token) return;
      try {
        setLoading(true);
        const [announcementsResult, eventsResult] = await Promise.allSettled([
          getOwnerAnnouncements(token),
          getMyEvents(token),
        ]);

        if (announcementsResult.status === 'fulfilled') {
          setAnnouncements(announcementsResult.value);
        } else {
          console.error('Error loading owner announcements:', announcementsResult.reason);
        }

        if (eventsResult.status === 'fulfilled') {
          setEvents(eventsResult.value);
        } else {
          console.error('Error loading owner events:', eventsResult.reason);
        }

        if (announcementsResult.status === 'rejected' || eventsResult.status === 'rejected') {
          toastError('No se pudieron cargar todos los avisos y eventos.');
        }
      } catch (err) {
        console.error('Error loading announcements page:', err);
        toastError('Error al cargar los avisos.');
      } finally {
        setLoading(false);
      }
    };

    loadItems();
  }, [token, toastError]);

  const items = useMemo(() => buildItems(announcements, events), [announcements, events]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return items.filter((item) => {
      if (filterStartDate && item.filterDate < filterStartDate) return false;
      if (filterEndDate && item.filterDate > filterEndDate) return false;
      if (!normalizedQuery) return true;
      return String(item.title || '').toLowerCase().includes(normalizedQuery);
    });
  }, [items, query, filterStartDate, filterEndDate]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [filteredItems, page]);

  useEffect(() => {
    setPage(1);
  }, [query, filterStartDate, filterEndDate]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    if (!filteredItems.length) {
      setSelectedKey('');
      return;
    }

    const announcementId = searchParams.get('announcementId');
    const eventId = searchParams.get('eventId');
    const preferredKey = announcementId
      ? `announcement-${announcementId}`
      : eventId
        ? `event-${eventId}`
        : '';

    const preferredIndex = preferredKey
      ? filteredItems.findIndex((item) => `${item.type}-${item.id}` === preferredKey)
      : -1;

    if (preferredIndex >= 0) {
      setSelectedKey(preferredKey);
      setPage(Math.floor(preferredIndex / PAGE_SIZE) + 1);
      return;
    }

    setSelectedKey(`${filteredItems[0].type}-${filteredItems[0].id}`);
  }, [filteredItems, searchParams]);

  const selectedItem = filteredItems.find((item) => `${item.type}-${item.id}` === selectedKey) || null;

  const handleSelect = (item) => {
    const key = `${item.type}-${item.id}`;
    setSelectedKey(key);
    setSearchParams(
      item.type === 'announcement'
        ? { announcementId: item.id }
        : { eventId: item.id }
    );
  };

  const clearFilters = () => {
    setQuery('');
    setFilterStartDate('');
    setFilterEndDate('');
  };

  if (loading) {
    return <div className={styles.loading}>Cargando avisos...</div>;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Avisos</h1>
        <p className={styles.subtitle}>
          Consulte comunicados, convocatorias y eventos publicados por la administración.
        </p>
      </header>

      {items.length === 0 ? (
        <section className={styles.emptyState}>
          <strong>No hay avisos publicados.</strong>
          <span>Cuando administración publique un aviso o evento, aparecerá en esta sección.</span>
        </section>
      ) : (
        <>
          <section className={styles.filtersPanel} aria-label="Filtros de avisos">
            <label className={styles.filterField}>
              Buscar por título
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ej. asamblea, mantenimiento..."
              />
            </label>

            <label className={styles.filterField}>
              Desde
              <input
                type="date"
                value={filterStartDate}
                onChange={(event) => setFilterStartDate(event.target.value)}
              />
            </label>

            <label className={styles.filterField}>
              Hasta
              <input
                type="date"
                value={filterEndDate}
                onChange={(event) => setFilterEndDate(event.target.value)}
              />
            </label>

            <button type="button" className={styles.clearButton} onClick={clearFilters}>
              Limpiar
            </button>
          </section>

          <div className={styles.resultsSummary}>
            {filteredItems.length} resultado{filteredItems.length === 1 ? '' : 's'}
          </div>

          {filteredItems.length === 0 ? (
            <section className={styles.emptyState}>
              <strong>No se encontraron avisos.</strong>
              <span>Ajuste el título o el rango de fechas para ampliar la búsqueda.</span>
            </section>
          ) : (
            <div className={styles.contentGrid}>
              <aside className={styles.listPanel} aria-label="Listado de avisos">
                {paginatedItems.map((item) => {
                  const key = `${item.type}-${item.id}`;
                  const isActive = key === selectedKey;
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`${styles.listItem} ${isActive ? styles.listItemActive : ''}`}
                      onClick={() => handleSelect(item)}
                    >
                      <span className={item.type === 'event' ? styles.eventBadge : styles.announcementBadge}>
                        {item.badge}
                      </span>
                      <strong>{item.title}</strong>
                      <small>{item.dateLabel}</small>
                    </button>
                  );
                })}

                {totalPages > 1 ? (
                  <div className={styles.pagination} aria-label="Paginación de avisos">
                    <button
                      type="button"
                      className={styles.pageButton}
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={page === 1}
                    >
                      Anterior
                    </button>
                    <span>Página {page} de {totalPages}</span>
                    <button
                      type="button"
                      className={styles.pageButton}
                      onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                      disabled={page === totalPages}
                    >
                      Siguiente
                    </button>
                  </div>
                ) : null}
              </aside>

              <article className={styles.detailPanel}>
                {selectedItem ? (
                  <>
                    <div className={styles.detailMeta}>
                      <span className={selectedItem.type === 'event' ? styles.eventBadge : styles.announcementBadge}>
                        {selectedItem.badge}
                      </span>
                      <span>{selectedItem.dateLabel}</span>
                    </div>
                    <h2>{selectedItem.title}</h2>
                    <div className={styles.description}>
                      {(selectedItem.description || 'Sin detalle adicional.').split('\n').map((line, index) => (
                        <p key={`${selectedItem.id}-${index}`}>{line || '\u00a0'}</p>
                      ))}
                    </div>
                  </>
                ) : null}
              </article>
            </div>
          )}
        </>
      )}
    </div>
  );
}

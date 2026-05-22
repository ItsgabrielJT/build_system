/**
 * ApartmentGrid Component
 * 
 * Grid paginado de departamentos con:
 * - Filtros por estado
 * - Grid de tarjetas (responsive: 1 móvil, 2 tablet, 4 desktop)
 * - Paginación
 */

import ApartmentCard from '../ApartmentCard/ApartmentCard';
import styles from './ApartmentGrid.module.css';

const FILTER_OPTIONS = [
  { label: 'Todos', value: 'TODOS' },
  { label: 'Ocupados', value: 'OCUPADO' },
  { label: 'Vacantes', value: 'VACANTE' },
  { label: 'Mantenimiento', value: 'MANTENIMIENTO' },
];

export default function ApartmentGrid({
  apartments,
  currentPage,
  totalPages,
  total,
  filter,
  loading,
  onFilterChange,
  onPageChange,
  onCardClick,
}) {
  const renderPaginationButtons = () => {
    const buttons = [];
    const maxButtons = 5;

    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);

    if (endPage - startPage + 1 < maxButtons) {
      startPage = Math.max(1, endPage - maxButtons + 1);
    }

    // Botón anterior
    buttons.push(
      <button
        key="prev"
        className={styles.paginationButton}
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        Anterior
      </button>
    );

    // Números de página
    for (let i = startPage; i <= endPage; i++) {
      buttons.push(
        <button
          key={i}
          className={`${styles.paginationButton} ${i === currentPage ? styles.active : ''}`}
          onClick={() => onPageChange(i)}
        >
          {i}
        </button>
      );
    }

    // Botón siguiente
    buttons.push(
      <button
        key="next"
        className={styles.paginationButton}
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        Siguiente
      </button>
    );

    return buttons;
  };

  return (
    <div className={styles.apartmentGrid}>
      <div className={styles.filterBar}>
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.value}
            className={`${styles.filterButton} ${filter === option.value ? styles.active : ''}`}
            onClick={() => onFilterChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {apartments.length > 0 ? (
        <>
          <div className={styles.gridContainer}>
            {apartments.map((apt) => (
              <ApartmentCard
                key={apt.id}
                apartment={apt}
                onClick={() => onCardClick?.(apt)}
              />
            ))}
          </div>

          <div className={styles.pagination}>
            {renderPaginationButtons()}
            <span className={styles.pageInfo}>
              {total > 0 ? `${(currentPage - 1) * 4 + 1} - ${Math.min(currentPage * 4, total)} de ${total}` : '0'}
            </span>
          </div>
        </>
      ) : (
        <div className={styles.emptyState}>
          <p>
            {loading
              ? 'Cargando departamentos...'
              : 'No hay departamentos registrados'}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * DepartmentsPage Component
 * 
 * Página de Directorio de Departamentos con:
 * - 4 tarjetas de estadísticas (ocupados, vacantes, mantenimiento, total)
 * - Filtros por estado
 * - Grid paginado de apartamentos (4 por página)
 * - Botón "Agregar Apartamento"
 */

import { useApartmentDirectory } from '../../hooks/useApartmentDirectory';
import DepartmentStats from '../../components/DepartmentStats/DepartmentStats';
import ApartmentGrid from '../../components/ApartmentGrid/ApartmentGrid';
import styles from './DepartmentsPage.module.css';

export default function DepartmentsPage() {
  const {
    statistics,
    apartments,
    currentPage,
    totalPages,
    total,
    filter,
    loading,
    error,
    itemsPerPage,
    onFilterChange,
    onPageChange,
  } = useApartmentDirectory();

  const handleAddApartment = () => {
    // TODO: Navegar a formulario de agregar apartamento
    alert('Función de agregar departamento será implementada próximamente');
  };

  return (
    <div className={styles.departmentsPage}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Directorio de Departamentos</h1>
        <button className={styles.addButton} onClick={handleAddApartment}>
          + Agregar Apartamento
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className={styles.errorContainer}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && statistics === null ? (
        <div className={styles.loadingContainer}>
          <p>Cargando departamentos...</p>
        </div>
      ) : (
        <>
          {/* Estadísticas */}
          <DepartmentStats statistics={statistics} loading={loading} />

          {/* Grid de apartamentos */}
          <ApartmentGrid
            apartments={apartments}
            currentPage={currentPage}
            totalPages={totalPages}
            total={total}
            filter={filter}
            loading={loading}
            onFilterChange={onFilterChange}
            onPageChange={onPageChange}
            onCardClick={(apartment) => {
              // TODO: Navegar a detalles del apartamento
              console.log('Apartamento seleccionado:', apartment);
            }}
          />
        </>
      )}
    </div>
  );
}

import { useApartmentDirectory } from '../../hooks/useApartmentDirectory';
import DepartmentStats from '../../components/DepartmentStats/DepartmentStats';
import ApartmentGrid from '../../components/ApartmentGrid/ApartmentGrid';
import FormModal from '../../components/FormModal/FormModal';
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
    showCreateModal,
    buildings,
    onFilterChange,
    onPageChange,
    onOpenCreateModal,
    onCloseCreateModal,
    onCreateApartment,
  } = useApartmentDirectory();

  const buildingOptions = buildings.map((b) => ({ value: b.id, label: b.name }));

  const createApartmentFields = [
    { name: 'code', label: 'Código de apartamento', required: true, placeholder: 'Ej: 101, A-202' },
    { name: 'floor', label: 'Piso', type: 'number', placeholder: 'Ej: 1', min: 1 },
    { name: 'tower', label: 'Torre', placeholder: 'Ej: A, Norte' },
    ...(buildingOptions.length > 0
      ? [{ name: 'building_id', label: 'Edificio', type: 'select', options: buildingOptions }]
      : []),
  ];

  return (
    <div className={styles.departmentsPage}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Directorio de Departamentos</h1>
        <button className={styles.addButton} onClick={onOpenCreateModal}>
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
              console.log('Apartamento seleccionado:', apartment);
            }}
          />
        </>
      )}

      {/* Modal crear apartamento */}
      <FormModal
        isOpen={showCreateModal}
        title="Agregar Apartamento"
        fields={createApartmentFields}
        onSubmit={onCreateApartment}
        onClose={onCloseCreateModal}
      />
    </div>
  );
}

/**
 * OwnersDirectoryPage Component
 * 
 * Página de Directorio de Propietarios con:
 * - Búsqueda (debounce 300ms)
 * - Tabla: PROPIETARIO, UNIDAD, CONTACTO, INGRESO, BALANCE, ACCIONES
 * - Modal detalles con transacciones recientes
 * - Paginación 10 por página
 */

import { useOwnerDirectory } from '../../hooks/useOwnerDirectory';
import OwnerDirectoryTable from '../../components/OwnerDirectoryTable/OwnerDirectoryTable';
import OwnerDetailModal from '../../components/OwnerDetailModal/OwnerDetailModal';
import styles from './OwnersDirectoryPage.module.css';

export default function OwnersDirectoryPage() {
  const {
    owners,
    currentPage,
    totalPages,
    total,
    searchTerm,
    loading,
    error,
    selectedOwner,
    onSearchChange,
    onPageChange,
    onSelectOwner,
    onCloseModal,
  } = useOwnerDirectory();

  const handleAddOwner = () => {
    // TODO: Navegar a formulario de agregar propietario
    alert('Función de agregar propietario será implementada próximamente');
  };

  return (
    <div className={styles.ownersDirectoryPage}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Directorio de Propietarios</h1>
          <p className={styles.pageSubtitle}>Gestiona la información de contacto, unidades y saldos de propietarios</p>
        </div>
        <button className={styles.addButton} onClick={handleAddOwner}>
          + Agregar Propietario
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className={styles.errorContainer}>
          {error}
        </div>
      )}

      {/* Tabla */}
      <OwnerDirectoryTable
        owners={owners}
        currentPage={currentPage}
        totalPages={totalPages}
        total={total}
        searchTerm={searchTerm}
        loading={loading}
        onSearchChange={onSearchChange}
        onPageChange={onPageChange}
        onSelectOwner={onSelectOwner}
      />

      {/* Modal de detalles */}
      {selectedOwner && (
        <OwnerDetailModal owner={selectedOwner} onClose={onCloseModal} />
      )}
    </div>
  );
}

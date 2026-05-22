import { useOwnerDirectory } from '../../hooks/useOwnerDirectory';
import OwnerDirectoryTable from '../../components/OwnerDirectoryTable/OwnerDirectoryTable';
import OwnerDetailModal from '../../components/OwnerDetailModal/OwnerDetailModal';
import FormModal from '../../components/FormModal/FormModal';
import styles from './OwnersDirectoryPage.module.css';

const CREATE_OWNER_FIELDS = [
  { name: 'full_name', label: 'Nombre completo', required: true, placeholder: 'Ej: Juan Pérez' },
  { name: 'document_id', label: 'Documento de identidad', required: true, placeholder: 'Ej: 1234567890' },
  { name: 'email', label: 'Correo electrónico', type: 'email', placeholder: 'correo@ejemplo.com' },
  { name: 'phone', label: 'Teléfono', type: 'tel', placeholder: 'Ej: +57 300 0000000' },
];

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
    showCreateModal,
    onSearchChange,
    onPageChange,
    onSelectOwner,
    onCloseModal,
    onOpenCreateModal,
    onCloseCreateModal,
    onCreateOwner,
    onRefresh,
  } = useOwnerDirectory();

  return (
    <div className={styles.ownersDirectoryPage}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Directorio de Propietarios</h1>
          <p className={styles.pageSubtitle}>Gestiona la información de contacto, unidades y saldos de propietarios</p>
        </div>
        <button className={styles.addButton} onClick={onOpenCreateModal}>
          + Agregar Propietario
        </button>
      </div>

      {error && <div className={styles.errorContainer}>{error}</div>}

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

      {selectedOwner && (
        <OwnerDetailModal
          owner={selectedOwner}
          onClose={onCloseModal}
          onRefresh={onRefresh}
        />
      )}

      <FormModal
        isOpen={showCreateModal}
        title="Agregar Propietario"
        fields={CREATE_OWNER_FIELDS}
        onSubmit={onCreateOwner}
        onClose={onCloseCreateModal}
      />
    </div>
  );
}

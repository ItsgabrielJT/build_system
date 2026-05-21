import { useState, useEffect } from 'react';
import { useOwners } from '../../hooks/useOwners';
import Table from '../../components/Table/Table';
import FormModal from '../../components/FormModal/FormModal';
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog';
import styles from './AdminOwnersPage.module.css';

const OWNER_FIELDS = [
  { name: 'full_name', label: 'Nombre completo', type: 'text', required: true },
  { name: 'document_id', label: 'Número de documento', type: 'text', required: true },
  { name: 'email', label: 'Correo electrónico', type: 'email' },
  { name: 'phone', label: 'Teléfono', type: 'tel' },
];

const COLUMNS = [
  { key: 'full_name', label: 'Nombre' },
  { key: 'document_id', label: 'Documento' },
  { key: 'email', label: 'Correo' },
  { key: 'phone', label: 'Teléfono' },
  {
    key: 'status',
    label: 'Estado',
    render: (val) => (
      <span style={{ color: val === 'ACTIVO' ? 'var(--color-success)' : 'var(--color-gray-500)' }}>
        {val}
      </span>
    ),
  },
];

export default function AdminOwnersPage() {
  const { owners, loading, error, fetchOwners, createOwner, updateOwner, deleteOwner } = useOwners();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    fetchOwners();
  }, [fetchOwners]);

  const handleCreate = async (data) => {
    await createOwner(data);
    setIsFormOpen(false);
  };

  const handleEdit = async (data) => {
    await updateOwner(editItem.id, data);
    setEditItem(null);
  };

  const handleDelete = async () => {
    setActionError(null);
    try {
      await deleteOwner(deleteItem.id);
    } catch (err) {
      setActionError(err.response?.data?.detail || 'Error al eliminar');
    } finally {
      setDeleteItem(null);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Propietarios</h1>
        <button className={styles.btnPrimary} onClick={() => setIsFormOpen(true)}>
          + Nuevo propietario
        </button>
      </div>

      {(error || actionError) && (
        <div className={styles.errorBanner}>{error || actionError}</div>
      )}

      <Table
        data={owners}
        columns={COLUMNS}
        loading={loading}
        onEdit={(item) => setEditItem(item)}
        onDelete={(item) => setDeleteItem(item)}
        emptyText="No hay propietarios registrados"
      />

      <FormModal
        isOpen={isFormOpen || !!editItem}
        title={editItem ? 'Editar propietario' : 'Nuevo propietario'}
        fields={OWNER_FIELDS}
        defaultValues={editItem}
        onSubmit={editItem ? handleEdit : handleCreate}
        onClose={() => { setIsFormOpen(false); setEditItem(null); }}
      />

      <ConfirmDialog
        isOpen={!!deleteItem}
        message={`¿Desactivar al propietario "${deleteItem?.full_name}"? Esta acción lo marcará como inactivo.`}
        confirmLabel="Desactivar"
        onConfirm={handleDelete}
        onCancel={() => setDeleteItem(null)}
      />
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useApartments } from '../../hooks/useApartments';
import { useOwners } from '../../hooks/useOwners';
import { useBuilding } from '../../hooks/useBuilding';
import { useAuth } from '../../hooks/useAuth';
import Table from '../../components/Table/Table';
import FormModal from '../../components/FormModal/FormModal';
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog';
import BuildingInfoModal from '../../components/BuildingInfoModal/BuildingInfoModal';
import styles from './AdminApartmentsPage.module.css';

const APARTMENT_FIELDS = [
  { name: 'code', label: 'Código', type: 'text', required: true, placeholder: 'ej. 101' },
  { name: 'floor', label: 'Piso', type: 'number', min: 0 },
  { name: 'tower', label: 'Torre', type: 'text', placeholder: 'ej. A' },
];

const COLUMNS = [
  { key: 'code', label: 'Código' },
  { key: 'floor', label: 'Piso' },
  { key: 'tower', label: 'Torre' },
  {
    key: 'owner_name',
    label: 'Propietario',
    render: (val) => val || 'Sin asignar',
  },
  {
    key: 'owner_email',
    label: 'Email del propietario',
    render: (val) => val || '—',
  },
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

export default function AdminApartmentsPage() {
  const { apartments, loading, error, fetchApartments, createApartment, assignOwner, removeOwner } =
    useApartments();
  const { owners, fetchOwners } = useOwners();
  const { building, fetchBuilding, updateBuilding } = useBuilding();
  const { token } = useAuth();
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isBuildingModalOpen, setIsBuildingModalOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [selectedOwnerId, setSelectedOwnerId] = useState('');
  const [actionError, setActionError] = useState(null);
  const [buildingId] = useState('default'); // Puede ser dinámico si hay múltiples edificios

  useEffect(() => {
    fetchApartments();
    fetchOwners();
    // Cargar información del edificio
    if (buildingId) {
      fetchBuilding(buildingId).catch(() => {
        // Si falla, continuar sin información del edificio
      });
    }
  }, [fetchApartments, fetchOwners, buildingId]);

  const handleCreate = async (data) => {
    await createApartment({ ...data, floor: data.floor ? parseInt(data.floor) : null });
    setIsFormOpen(false);
  };

  const handleAssign = async () => {
    if (!selectedOwnerId) return;
    setActionError(null);
    try {
      await assignOwner(assignTarget.id, selectedOwnerId, {});
      await fetchApartments();
    } catch (err) {
      setActionError(err.response?.data?.detail || 'Error al asignar');
    } finally {
      setAssignTarget(null);
      setSelectedOwnerId('');
    }
  };

  const handleRemove = async () => {
    setActionError(null);
    try {
      await removeOwner(removeTarget.apartmentId, removeTarget.ownerId);
      await fetchApartments();
    } catch (err) {
      setActionError(err.response?.data?.detail || 'Error al remover');
    } finally {
      setRemoveTarget(null);
    }
  };

  const handleSaveBuilding = async (data) => {
    try {
      await updateBuilding(buildingId, data);
      await fetchApartments(); // Refrescar por si cambió algo relevante
    } catch (err) {
      throw err;
    }
  };

  const columnsWithAction = [
    ...COLUMNS,
    {
      key: 'owners',
      label: 'Propietarios',
      render: (val, row) => (
        <div className={styles.ownersList}>
          {(val || []).map((o) => (
            <span key={o.id} className={styles.ownerChip}>
              {o.full_name}
              <button
                className={styles.chipRemove}
                onClick={(e) => { e.stopPropagation(); setRemoveTarget({ apartmentId: row.id, ownerId: o.id, ownerName: o.full_name }); }}
              >
                ✕
              </button>
            </span>
          ))}
          <button className={styles.btnAssign} onClick={(e) => { e.stopPropagation(); setAssignTarget(row); }}>
            + Asignar
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Departamentos</h1>
        <div className={styles.headerActions}>
          <button 
            className={styles.btnSecondary} 
            onClick={() => setIsBuildingModalOpen(true)}
            title="Editar información del edificio"
          >
            🏢 Editar Edificio
          </button>
          <button className={styles.btnPrimary} onClick={() => setIsFormOpen(true)}>
            + Nuevo departamento
          </button>
        </div>
      </div>

      {(error || actionError) && (
        <div className={styles.errorBanner}>{error || actionError}</div>
      )}

      <Table
        data={apartments}
        columns={columnsWithAction}
        loading={loading}
        emptyText="No hay departamentos registrados"
      />

      <FormModal
        isOpen={isFormOpen}
        title="Nuevo departamento"
        fields={APARTMENT_FIELDS}
        onSubmit={handleCreate}
        onClose={() => setIsFormOpen(false)}
      />

      {assignTarget && (
        <div className={styles.overlay} onClick={() => setAssignTarget(null)}>
          <div className={styles.assignDialog} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.assignTitle}>Asignar propietario a Depto {assignTarget.code}</h3>
            <select
              className={styles.select}
              value={selectedOwnerId}
              onChange={(e) => setSelectedOwnerId(e.target.value)}
            >
              <option value="">Seleccionar propietario...</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>{o.full_name} — {o.document_id}</option>
              ))}
            </select>
            <div className={styles.assignActions}>
              <button className={styles.btnCancel} onClick={() => setAssignTarget(null)}>Cancelar</button>
              <button className={styles.btnPrimary} onClick={handleAssign} disabled={!selectedOwnerId}>
                Asignar
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!removeTarget}
        message={`¿Remover a "${removeTarget?.ownerName}" de este departamento?`}
        confirmLabel="Remover"
        onConfirm={handleRemove}
        onCancel={() => setRemoveTarget(null)}
      />

      <BuildingInfoModal
        isOpen={isBuildingModalOpen}
        onClose={() => setIsBuildingModalOpen(false)}
        onSave={handleSaveBuilding}
        building={building}
      />
    </div>
  );
}

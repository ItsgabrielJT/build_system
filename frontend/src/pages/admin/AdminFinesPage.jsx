import { useState, useEffect } from 'react';
import { useFines } from '../../hooks/useFines';
import { useApartments } from '../../hooks/useApartments';
import { useOwners } from '../../hooks/useOwners';
import Table from '../../components/Table/Table';
import FormModal from '../../components/FormModal/FormModal';
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog';
import PeriodSelector from '../../components/PeriodSelector/PeriodSelector';
import styles from './AdminFinesPage.module.css';

const STATUS_COLORS = { ACTIVA: 'var(--color-danger)', ANULADA: 'var(--color-gray-400)' };

const COLUMNS = [
  { key: 'period', label: 'Período' },
  { key: 'apartment_code', label: 'Departamento' },
  { key: 'owner_name', label: 'Propietario' },
  { key: 'reason', label: 'Motivo' },
  { key: 'amount', label: 'Monto', render: (v) => `$${Number(v).toLocaleString()}` },
  { key: 'issued_at', label: 'Fecha emisión' },
  {
    key: 'status',
    label: 'Estado',
    render: (v) => <span style={{ color: STATUS_COLORS[v] || 'inherit', fontWeight: 600 }}>{v}</span>,
  },
];

export default function AdminFinesPage() {
  const { fines, loading, error, fetchFines, createFine, annulFine } = useFines();
  const { apartments, fetchApartments } = useApartments();
  const { owners, fetchOwners } = useOwners();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [annulTarget, setAnnulTarget] = useState(null);
  const [filterPeriod, setFilterPeriod] = useState('');
  const [actionError, setActionError] = useState(null);
  const [formData, setFormData] = useState({});
  const [filteredApartments, setFilteredApartments] = useState([]);

  // Inicializar período con mes actual
  const getCurrentMonth = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  };

  useEffect(() => {
    fetchApartments();
    fetchOwners();
  }, [fetchApartments, fetchOwners]);

  useEffect(() => {
    fetchFines(filterPeriod ? { period: filterPeriod } : {});
  }, [filterPeriod, fetchFines]);

  // Cuando abre el formulario, inicializar periodo con mes actual
  useEffect(() => {
    if (isFormOpen) {
      setFormData((prev) => ({
        ...prev,
        period: getCurrentMonth(),
      }));
      setFilteredApartments(apartments);
    }
  }, [isFormOpen, apartments]);

  // Manejar cambio de apartamento - auto-cargar propietario
  const handleApartmentChange = (apartmentId) => {
    const selectedApartment = apartments.find((a) => a.id === apartmentId);
    if (selectedApartment?.owner_id) {
      setFormData((prev) => ({
        ...prev,
        apartment_id: apartmentId,
        owner_id: selectedApartment.owner_id,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        apartment_id: apartmentId,
        owner_id: '',
      }));
    }
  };

  // Manejar cambio de propietario - filtrar apartamentos
  const handleOwnerChange = (ownerId) => {
    const filtered = apartments.filter((a) => a.owner_id === ownerId);
    setFilteredApartments(filtered);
    setFormData((prev) => ({
      ...prev,
      owner_id: ownerId,
      apartment_id: filtered.length === 1 ? filtered[0].id : '',
    }));
  };

  // Campos dinámicos del formulario
  const getFineFields = () => [
    {
      name: 'apartment_id',
      label: 'Departamento',
      type: 'select',
      required: true,
      options: filteredApartments.length > 0 
        ? filteredApartments.map((a) => ({ value: a.id, label: `Depto ${a.code}` }))
        : apartments.map((a) => ({ value: a.id, label: `Depto ${a.code}` })),
      onChange: handleApartmentChange,
    },
    {
      name: 'owner_id',
      label: 'Propietario',
      type: 'select',
      required: true,
      options: owners.map((o) => ({ value: o.id, label: o.full_name })),
      onChange: handleOwnerChange,
    },
    { name: 'period', label: 'Período (YYYY-MM)', type: 'month', required: true },
    { name: 'amount', label: 'Monto', type: 'number', required: true, min: '0', step: '0.01' },
    { name: 'reason', label: 'Motivo', type: 'textarea', required: true },
    { name: 'issued_at', label: 'Fecha de emisión', type: 'date', required: true },
  ];

  const handleCreate = async (data) => {
    await createFine({ ...data, amount: parseFloat(data.amount) });
    setIsFormOpen(false);
    setFormData({});
    setFilteredApartments(apartments);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setFormData({});
    setFilteredApartments(apartments);
  };

  const handleAnnul = async () => {
    setActionError(null);
    try {
      await annulFine(annulTarget.id);
    } catch (err) {
      setActionError(err.response?.data?.detail || 'Error al anular multa');
    } finally {
      setAnnulTarget(null);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Multas</h1>
        <div className={styles.headerActions}>
          <PeriodSelector period={filterPeriod} onChange={setFilterPeriod} label="Filtrar período:" />
          <button className={styles.btnPrimary} onClick={() => setIsFormOpen(true)}>
            + Registrar multa
          </button>
        </div>
      </div>

      {(error || actionError) && (
        <div className={styles.errorBanner}>{error || actionError}</div>
      )}

      <Table
        data={fines}
        columns={COLUMNS}
        loading={loading}
        onDelete={(item) => item.status === 'ACTIVA' ? setAnnulTarget(item) : null}
        emptyText="No hay multas registradas"
      />

      <FormModal
        isOpen={isFormOpen}
        title="Registrar multa"
        fields={getFineFields()}
        initialData={formData}
        onSubmit={handleCreate}
        onClose={handleFormClose}
      />

      <ConfirmDialog
        isOpen={!!annulTarget}
        message={`¿Anular la multa de $${Number(annulTarget?.amount || 0).toLocaleString()}? El registro permanecerá en el sistema.`}
        confirmLabel="Anular multa"
        onConfirm={handleAnnul}
        onCancel={() => setAnnulTarget(null)}
      />
    </div>
  );
}

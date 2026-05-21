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

  useEffect(() => {
    fetchApartments();
    fetchOwners();
  }, [fetchApartments, fetchOwners]);

  useEffect(() => {
    fetchFines(filterPeriod ? { period: filterPeriod } : {});
  }, [filterPeriod, fetchFines]);

  const fineFields = [
    {
      name: 'apartment_id',
      label: 'Departamento',
      type: 'select',
      required: true,
      options: apartments.map((a) => ({ value: a.id, label: `Depto ${a.code}` })),
    },
    {
      name: 'owner_id',
      label: 'Propietario',
      type: 'select',
      required: true,
      options: owners.map((o) => ({ value: o.id, label: o.full_name })),
    },
    { name: 'period', label: 'Período (YYYY-MM)', type: 'month', required: true },
    { name: 'amount', label: 'Monto', type: 'number', required: true, min: '0', step: '0.01' },
    { name: 'reason', label: 'Motivo', type: 'textarea', required: true },
    { name: 'issued_at', label: 'Fecha de emisión', type: 'date', required: true },
  ];

  const handleCreate = async (data) => {
    await createFine({ ...data, amount: parseFloat(data.amount) });
    setIsFormOpen(false);
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
        fields={fineFields}
        onSubmit={handleCreate}
        onClose={() => setIsFormOpen(false)}
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

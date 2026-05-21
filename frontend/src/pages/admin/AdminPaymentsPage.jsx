import { useState, useEffect } from 'react';
import { usePayments } from '../../hooks/usePayments';
import { useApartments } from '../../hooks/useApartments';
import { useOwners } from '../../hooks/useOwners';
import Table from '../../components/Table/Table';
import FormModal from '../../components/FormModal/FormModal';
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog';
import PeriodSelector from '../../components/PeriodSelector/PeriodSelector';
import styles from './AdminPaymentsPage.module.css';

const STATUS_COLORS = { REGISTRADO: 'var(--color-success)', ANULADO: 'var(--color-gray-400)' };

const COLUMNS = [
  { key: 'period', label: 'Período' },
  { key: 'apartment_code', label: 'Departamento' },
  { key: 'owner_name', label: 'Propietario' },
  { key: 'amount', label: 'Monto', render: (v) => `$${Number(v).toLocaleString()}` },
  { key: 'method', label: 'Método' },
  { key: 'paid_at', label: 'Fecha pago' },
  {
    key: 'status',
    label: 'Estado',
    render: (v) => <span style={{ color: STATUS_COLORS[v] || 'inherit', fontWeight: 600 }}>{v}</span>,
  },
];

const getCurrentMonth = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
};

export default function AdminPaymentsPage() {
  const { payments, loading, error, fetchPayments, createPayment, annulPayment } = usePayments();
  const { apartments, fetchApartments } = useApartments();
  const { owners, fetchOwners } = useOwners();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [annulTarget, setAnnulTarget] = useState(null);
  const [filterPeriod, setFilterPeriod] = useState('');
  const [actionError, setActionError] = useState(null);
  const [filteredApartments, setFilteredApartments] = useState([]);

  useEffect(() => {
    fetchApartments();
    fetchOwners();
  }, [fetchApartments, fetchOwners]);

  useEffect(() => {
    fetchPayments(filterPeriod ? { period: filterPeriod } : {});
  }, [filterPeriod, fetchPayments]);

  const handleApartmentChange = (apartmentId) => {
    const selectedApartment = apartments.find((a) => String(a.id) === String(apartmentId));
    return { owner_id: selectedApartment?.owner_id || '' };
  };

  const handleOwnerChange = (ownerId) => {
    const filtered = apartments.filter((a) => String(a.owner_id) === String(ownerId));
    setFilteredApartments(filtered);
    return {
      owner_id: ownerId,
      apartment_id: filtered.length === 1 ? filtered[0].id : '',
    };
  };

  const getPaymentFields = () => [
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
    { name: 'period', label: 'Período (YYYY-MM)', type: 'month', required: true, defaultValue: getCurrentMonth() },
    { name: 'amount', label: 'Monto', type: 'number', required: true, min: '0', step: '0.01' },
    {
      name: 'method',
      label: 'Método de pago',
      type: 'select',
      options: [
        { value: 'transferencia', label: 'Transferencia' },
        { value: 'efectivo', label: 'Efectivo' },
        { value: 'cheque', label: 'Cheque' },
      ],
    },
    { name: 'reference', label: 'Referencia / Comprobante', type: 'text' },
    { name: 'paid_at', label: 'Fecha de pago', type: 'date', required: true },
  ];

  const handleCreate = async (data) => {
    await createPayment({ ...data, amount: parseFloat(data.amount) });
    setIsFormOpen(false);
    setFilteredApartments([]);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setFilteredApartments([]);
  };

  const handleAnnul = async () => {
    setActionError(null);
    try {
      await annulPayment(annulTarget.id);
    } catch (err) {
      setActionError(err.response?.data?.detail || 'Error al anular pago');
    } finally {
      setAnnulTarget(null);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Pagos</h1>
        <div className={styles.headerActions}>
          <PeriodSelector period={filterPeriod} onChange={setFilterPeriod} label="Filtrar período:" />
          <button className={styles.btnPrimary} onClick={() => setIsFormOpen(true)}>
            + Registrar pago
          </button>
        </div>
      </div>

      {(error || actionError) && (
        <div className={styles.errorBanner}>{error || actionError}</div>
      )}

      <Table
        data={payments}
        columns={COLUMNS}
        loading={loading}
        onDelete={(item) => item.status === 'REGISTRADO' ? setAnnulTarget(item) : null}
        emptyText="No hay pagos registrados"
      />

      <FormModal
        isOpen={isFormOpen}
        title="Registrar pago"
        fields={getPaymentFields()}
        onSubmit={handleCreate}
        onClose={handleFormClose}
      />

      <ConfirmDialog
        isOpen={!!annulTarget}
        message={`¿Anular el pago de $${Number(annulTarget?.amount || 0).toLocaleString()}?`}
        confirmLabel="Anular"
        onConfirm={handleAnnul}
        onCancel={() => setAnnulTarget(null)}
      />
    </div>
  );
}

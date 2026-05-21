import { useState, useEffect } from 'react';
import { useExpenses } from '../../hooks/useExpenses';
import Table from '../../components/Table/Table';
import FormModal from '../../components/FormModal/FormModal';
import PeriodSelector from '../../components/PeriodSelector/PeriodSelector';
import StatCard from '../../components/StatCard/StatCard';
import styles from './AdminExpensesPage.module.css';

const EXPENSE_FIELDS = [
  { name: 'date', label: 'Fecha', type: 'date', required: true },
  { name: 'provider', label: 'Proveedor', type: 'text' },
  {
    name: 'category',
    label: 'Categoría',
    type: 'select',
    options: [
      { value: 'Servicios', label: 'Servicios' },
      { value: 'Mantenimiento', label: 'Mantenimiento' },
      { value: 'Seguridad', label: 'Seguridad' },
      { value: 'Limpieza', label: 'Limpieza' },
      { value: 'Administración', label: 'Administración' },
      { value: 'Otros', label: 'Otros' },
    ],
  },
  { name: 'concept', label: 'Concepto', type: 'text', required: true },
  { name: 'amount', label: 'Monto', type: 'number', required: true, min: '0', step: '0.01' },
];

const COLUMNS = [
  { key: 'date', label: 'Fecha' },
  { key: 'provider', label: 'Proveedor' },
  { key: 'category', label: 'Categoría' },
  { key: 'concept', label: 'Concepto' },
  { key: 'amount', label: 'Monto', render: (v) => `$${Number(v).toLocaleString()}` },
  { key: 'status', label: 'Estado' },
];

export default function AdminExpensesPage() {
  const currentPeriod = new Date().toISOString().slice(0, 7);
  const [filterMonth, setFilterMonth] = useState(currentPeriod);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [actionError, setActionError] = useState(null);

  const { expenses, total, loading, error, fetchExpenses, createExpense } = useExpenses();

  useEffect(() => {
    if (filterMonth) fetchExpenses(filterMonth);
  }, [filterMonth, fetchExpenses]);

  const handleCreate = async (data) => {
    await createExpense({ ...data, amount: parseFloat(data.amount) });
    setIsFormOpen(false);
    fetchExpenses(filterMonth);
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Gastos</h1>
        <div className={styles.headerActions}>
          <PeriodSelector period={filterMonth} onChange={setFilterMonth} label="Período:" />
          <button className={styles.btnPrimary} onClick={() => setIsFormOpen(true)}>
            + Registrar gasto
          </button>
        </div>
      </div>

      {(error || actionError) && (
        <div className={styles.errorBanner}>{error || actionError}</div>
      )}

      <div className={styles.statsRow}>
        <StatCard label="Total gastos" value={`$${Number(total).toLocaleString()}`} icon="📉" color="danger" />
        <StatCard label="Registros" value={expenses.length} icon="📋" color="primary" />
      </div>

      <Table
        data={expenses}
        columns={COLUMNS}
        loading={loading}
        emptyText="No hay gastos para este período"
      />

      <FormModal
        isOpen={isFormOpen}
        title="Registrar gasto"
        fields={EXPENSE_FIELDS}
        onSubmit={handleCreate}
        onClose={() => setIsFormOpen(false)}
      />
    </div>
  );
}

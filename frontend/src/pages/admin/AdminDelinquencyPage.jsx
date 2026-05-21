import { useState, useEffect } from 'react';
import { useDelinquency } from '../../hooks/useDelinquency';
import Table from '../../components/Table/Table';
import DelinquencyBadge from '../../components/DelinquencyBadge/DelinquencyBadge';
import StatCard from '../../components/StatCard/StatCard';
import styles from './AdminDelinquencyPage.module.css';

const COLUMNS = [
  { key: 'owner_name', label: 'Propietario' },
  { key: 'email', label: 'Correo' },
  { key: 'deuda_total', label: 'Deuda total', render: (v) => `$${Number(v || 0).toLocaleString()}` },
  { key: 'periodos_vencidos', label: 'Períodos vencidos' },
  {
    key: 'status',
    label: 'Estado',
    render: (v) => <DelinquencyBadge status={v || 'OVERDUE'} />,
  },
];

const DETAIL_COLUMNS = [
  { key: 'period', label: 'Período' },
  { key: 'apartment_code', label: 'Departamento' },
  { key: 'esperado', label: 'Esperado', render: (v) => `$${Number(v || 0).toLocaleString()}` },
  { key: 'multas', label: 'Multas', render: (v) => `$${Number(v || 0).toLocaleString()}` },
  { key: 'pagado', label: 'Pagado', render: (v) => `$${Number(v || 0).toLocaleString()}` },
  { key: 'saldo', label: 'Saldo', render: (v) => <strong style={{ color: v > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>${Number(v || 0).toLocaleString()}</strong> },
  { key: 'status', label: 'Estado', render: (v) => <DelinquencyBadge status={v} /> },
];

export default function AdminDelinquencyPage() {
  const { delinquentOwners, ownerDetail, loading, error, fetchDelinquentOwners, fetchOwnerDetail } =
    useDelinquency();
  const [selectedOwner, setSelectedOwner] = useState(null);

  useEffect(() => {
    fetchDelinquentOwners({ status: 'OVERDUE' });
  }, [fetchDelinquentOwners]);

  const handleViewDetail = async (owner) => {
    setSelectedOwner(owner);
    await fetchOwnerDetail(owner.id || owner.owner_id);
  };

  const detailRows = ownerDetail?.apartments?.flatMap((apt) =>
    (apt.periods || []).map((p) => ({ ...p, apartment_code: apt.apartment?.code }))
  ) || [];

  const totalDeuda = delinquentOwners.reduce((acc, o) => acc + (o.deuda_total || 0), 0);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Morosidad</h1>
        <button className={styles.btnRefresh} onClick={() => fetchDelinquentOwners({ status: 'OVERDUE' })}>
          Actualizar
        </button>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.statsRow}>
        <StatCard label="Propietarios en mora" value={delinquentOwners.length} icon="🔴" color="danger" />
        <StatCard label="Deuda total vencida" value={`$${Number(totalDeuda).toLocaleString()}`} icon="💸" color="warning" />
      </div>

      <Table
        data={delinquentOwners}
        columns={[
          ...COLUMNS,
          {
            key: '_actions',
            label: 'Detalle',
            render: (_, row) => (
              <button className={styles.btnDetail} onClick={() => handleViewDetail(row)}>
                Ver detalle
              </button>
            ),
          },
        ]}
        loading={loading}
        emptyText="No hay propietarios en mora"
      />

      {selectedOwner && (
        <div className={styles.detailSection}>
          <div className={styles.detailHeader}>
            <h2 className={styles.detailTitle}>
              Detalle: {selectedOwner.owner_name || selectedOwner.full_name}
            </h2>
            <button className={styles.btnClose} onClick={() => setSelectedOwner(null)}>
              ✕ Cerrar
            </button>
          </div>
          <Table
            data={detailRows}
            columns={DETAIL_COLUMNS}
            loading={loading}
            emptyText="Sin períodos registrados"
          />
        </div>
      )}
    </div>
  );
}

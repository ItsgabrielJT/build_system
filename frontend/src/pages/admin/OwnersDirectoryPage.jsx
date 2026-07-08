import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useOwnerDirectory } from '../../hooks/useOwnerDirectory';
import OwnerDirectoryTable from '../../components/OwnerDirectoryTable/OwnerDirectoryTable';
import OwnerDetailModal from '../../components/OwnerDetailModal/OwnerDetailModal';
import FormModal from '../../components/FormModal/FormModal';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../context/NotificationContext';
import { downloadOwnersReport } from '../../services/reportService';
import styles from './OwnersDirectoryPage.module.css';

const CREATE_OWNER_FIELDS = [
  { name: 'full_name', label: 'Nombre completo', required: true, placeholder: 'Ej: Juan Pérez' },
  { name: 'document_id', label: 'Documento de identidad', required: true, placeholder: 'Ej: 1234567890' },
  { name: 'email', label: 'Correo electrónico', type: 'email', placeholder: 'correo@ejemplo.com' },
  { name: 'phone', label: 'Teléfono', type: 'tel', placeholder: 'Ej: +57 300 0000000' },
];

const OWNER_FILTERS = [
  { value: 'TODOS', label: 'Todos' },
  { value: 'CON_UNIDADES', label: 'Con unidades' },
  { value: 'SIN_UNIDADES', label: 'Sin unidades' },
  { value: 'CON_SALDO', label: 'Con saldo' },
  { value: 'AL_DIA', label: 'Al día' },
];

const CHART_COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626'];

const formatCurrency = (value) => `$${Number(value || 0).toLocaleString('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function OwnersDirectoryPage() {
  const { token } = useAuth();
  const { success, error: toastError } = useNotification();
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

  const [ownerFilter, setOwnerFilter] = useState('TODOS');
  const [exportingReport, setExportingReport] = useState(null);

  const visibleOwners = useMemo(() => {
    switch (ownerFilter) {
      case 'CON_UNIDADES':
        return owners.filter((owner) => (owner.units || []).length > 0);
      case 'SIN_UNIDADES':
        return owners.filter((owner) => !(owner.units || []).length);
      case 'CON_SALDO':
        return owners.filter((owner) => Number(owner.balance || 0) > 0);
      case 'AL_DIA':
        return owners.filter((owner) => Number(owner.balance || 0) <= 0);
      default:
        return owners;
    }
  }, [owners, ownerFilter]);

  const ownerStats = useMemo(() => {
    const withUnits = visibleOwners.filter((owner) => (owner.units || []).length > 0).length;
    const withBalance = visibleOwners.filter((owner) => Number(owner.balance || 0) > 0).length;
    const totalBalance = visibleOwners.reduce((sum, owner) => sum + Math.max(Number(owner.balance || 0), 0), 0);
    const totalUnits = visibleOwners.reduce((sum, owner) => sum + (owner.units || []).length, 0);

    return {
      withUnits,
      withBalance,
      totalBalance,
      totalUnits,
      visible: visibleOwners.length,
      assignmentRate: visibleOwners.length ? Math.round((withUnits / visibleOwners.length) * 100) : 0,
    };
  }, [visibleOwners]);

  const assignmentData = useMemo(() => ([
    { name: 'Con unidades', value: ownerStats.withUnits },
    { name: 'Sin unidades', value: Math.max(ownerStats.visible - ownerStats.withUnits, 0) },
  ]), [ownerStats]);

  const balanceData = useMemo(() => ([
    { label: 'Saldo pendiente', propietarios: ownerStats.withBalance },
    { label: 'Al día / crédito', propietarios: Math.max(ownerStats.visible - ownerStats.withBalance, 0) },
  ]), [ownerStats]);

  const handleDownloadReport = async (format) => {
    setExportingReport(format);
    try {
      const blob = await downloadOwnersReport(token, {
        format,
      });
      const ext = format === 'excel' ? 'xlsx' : 'pdf';
      triggerDownload(blob, `reporte-propietarios.${ext}`);
      success(`Reporte de propietarios descargado en ${format === 'excel' ? 'Excel' : 'PDF'}`);
    } catch (err) {
      toastError(err.response?.data?.detail || 'Error al descargar el reporte de propietarios');
    } finally {
      setExportingReport(null);
    }
  };

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <div className={styles.breadcrumb}>Admin / Propietarios</div>
          <h1 className={styles.title}>Directorio de Propietarios</h1>
          <p className={styles.subtitle}>
            Contactos, unidades asignadas y saldos consolidados calculados desde los registros reales.
          </p>
        </div>
        <div className={styles.reportActions}>
          <button className={styles.btnReport} onClick={() => handleDownloadReport('pdf')} disabled={exportingReport === 'pdf'}>
            {exportingReport === 'pdf' ? 'Generando...' : 'PDF'}
          </button>
          <button className={styles.btnReportSecondary} onClick={() => handleDownloadReport('excel')} disabled={exportingReport === 'excel'}>
            {exportingReport === 'excel' ? 'Generando...' : 'Excel'}
          </button>
          <button className={styles.btnPrimary} onClick={onOpenCreateModal}>
            + Agregar Propietario
          </button>
        </div>
      </section>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <section className={styles.metricsGrid}>
        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>Propietarios visibles</span>
          <strong className={styles.metricValue}>{ownerStats.visible}</strong>
          <span className={styles.metricFoot}>{total} propietarios en el directorio</span>
        </article>
        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>Unidades asignadas</span>
          <strong className={styles.metricValue}>{ownerStats.totalUnits}</strong>
          <span className={styles.metricFoot}>{ownerStats.assignmentRate}% con unidad en esta vista</span>
        </article>
        <article className={`${styles.metricCard} ${styles.warningCard}`}>
          <span className={styles.metricLabel}>Saldo pendiente visible</span>
          <strong className={styles.metricValue}>{formatCurrency(ownerStats.totalBalance)}</strong>
          <span className={styles.metricFoot}>{ownerStats.withBalance} propietarios con saldo</span>
        </article>
      </section>

      <section className={styles.dashboardGrid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Asignación de unidades</h2>
              <p>Distribución de propietarios en la página y filtros actuales.</p>
            </div>
          </div>
          {ownerStats.visible ? (
            <div className={styles.chartBox}>
              <ResponsiveContainer width="100%" height={230}>
                <PieChart>
                  <Pie data={assignmentData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={82} paddingAngle={4}>
                    {assignmentData.map((entry, index) => (
                      <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className={styles.emptyState}>No hay propietarios para graficar.</div>
          )}
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Estado de saldos</h2>
              <p>Propietarios con saldo pendiente frente a propietarios al día o con crédito.</p>
            </div>
          </div>
          {ownerStats.visible ? (
            <div className={styles.chartBox}>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={balanceData} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="propietarios" fill="#2563eb" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className={styles.emptyState}>No hay saldos para graficar.</div>
          )}
        </article>
      </section>

      <section className={styles.panel}>
        <div className={styles.tableHeader}>
          <div>
            <h2>Propietarios</h2>
            <p>{visibleOwners.length} registros visibles en la página actual.</p>
          </div>
          <select
            className={styles.select}
            value={ownerFilter}
            onChange={(event) => setOwnerFilter(event.target.value)}
            aria-label="Filtrar propietarios"
          >
            {OWNER_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

      <OwnerDirectoryTable
        owners={visibleOwners}
        currentPage={currentPage}
        totalPages={totalPages}
        total={total}
        searchTerm={searchTerm}
        loading={loading}
        onSearchChange={onSearchChange}
        onPageChange={onPageChange}
        onSelectOwner={onSelectOwner}
      />
      </section>

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

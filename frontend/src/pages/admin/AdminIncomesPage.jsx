import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useIncomes } from '../../hooks/useIncomes';
import { useApartments } from '../../hooks/useApartments';
import { useOwners } from '../../hooks/useOwners';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../context/NotificationContext';
import { downloadIncomeReport } from '../../services/reportService';
import FormModal from '../../components/FormModal/FormModal';
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog';
import DownloadIcon from '../../components/icons/DownloadIcon';
import { formatApiError } from '../../utils/apiError';
import styles from './AdminPaymentsPage.module.css';

const STATUS_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'REGISTRADO', label: 'Registrados' },
  { value: 'ANULADO', label: 'Anulados' },
];

const METHOD_OPTIONS = [
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'deposito', label: 'Depósito' },
  { value: 'otro', label: 'Otro' },
];

const CATEGORY_OPTIONS = [
  { value: 'Arriendos', label: 'Arriendos' },
  { value: 'Áreas comunes', label: 'Áreas comunes' },
  { value: 'Multas y recargos', label: 'Multas y recargos' },
  { value: 'Intereses', label: 'Intereses' },
  { value: 'Otros ingresos', label: 'Otros ingresos' },
];

const STATUS_CONFIG = {
  REGISTRADO: { label: 'Registrado', className: 'statusPaid' },
  ANULADO: { label: 'Anulado', className: 'statusAnnulled' },
};

const PAGE_SIZE = 8;

const todayIso = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => todayIso().slice(0, 7);

const currentMonthRange = () => {
  const now = new Date();
  return {
    startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
    endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10),
  };
};

const formatCurrency = (value) => `$${Number(value || 0).toLocaleString(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

const formatDate = (value) => {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short', year: 'numeric' })
    .format(new Date(`${value}T00:00:00`));
};

const triggerDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export default function AdminIncomesPage() {
  const initialRange = useMemo(() => currentMonthRange(), []);
  const { incomes, loading, error, fetchIncomes, createIncome, annulIncome } = useIncomes();
  const { apartments, fetchApartments } = useApartments();
  const { owners, fetchOwners } = useOwners();
  const { token } = useAuth();
  const { success, error: toastError } = useNotification();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [annulTarget, setAnnulTarget] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterStartDate, setFilterStartDate] = useState(initialRange.startDate);
  const [filterEndDate, setFilterEndDate] = useState(initialRange.endDate);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [actionError, setActionError] = useState(null);
  const [exportingReport, setExportingReport] = useState(null);

  const fetchParams = useMemo(() => ({
    ...(filterStatus ? { status: filterStatus } : {}),
    ...(filterStartDate ? { start_date: filterStartDate } : {}),
    ...(filterEndDate ? { end_date: filterEndDate } : {}),
  }), [filterStatus, filterStartDate, filterEndDate]);

  useEffect(() => {
    fetchApartments();
    fetchOwners();
  }, [fetchApartments, fetchOwners]);

  useEffect(() => {
    fetchIncomes(fetchParams);
  }, [fetchIncomes, fetchParams]);

  const visibleIncomes = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return incomes.filter((income) => {
      if (!normalized) return true;
      return [
        income.concept,
        income.source,
        income.category,
        income.method,
        income.reference,
        income.owner_name,
        income.apartment_code,
        income.period,
        income.status,
      ].some((value) => String(value || '').toLowerCase().includes(normalized));
    });
  }, [incomes, query]);

  const registeredIncomes = useMemo(
    () => visibleIncomes.filter((income) => income.status === 'REGISTRADO'),
    [visibleIncomes]
  );
  const annulledIncomes = useMemo(
    () => visibleIncomes.filter((income) => income.status === 'ANULADO'),
    [visibleIncomes]
  );
  const totalRegistered = useMemo(
    () => registeredIncomes.reduce((sum, income) => sum + Number(income.amount || 0), 0),
    [registeredIncomes]
  );
  const totalAnnulled = useMemo(
    () => annulledIncomes.reduce((sum, income) => sum + Number(income.amount || 0), 0),
    [annulledIncomes]
  );
  const categoryData = useMemo(() => {
    const map = new Map();
    registeredIncomes.forEach((income) => {
      const label = income.category || income.source || 'Otros ingresos';
      const current = map.get(label) || { label, total: 0 };
      current.total += Number(income.amount || 0);
      map.set(label, current);
    });
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [registeredIncomes]);

  const trendData = useMemo(() => {
    const map = new Map();
    visibleIncomes.forEach((income) => {
      const period = income.period || String(income.date || '').slice(0, 7);
      if (!period) return;
      const current = map.get(period) || { period, registrado: 0, anulado: 0 };
      if (income.status === 'ANULADO') current.anulado += Number(income.amount || 0);
      else current.registrado += Number(income.amount || 0);
      map.set(period, current);
    });
    return [...map.values()].sort((a, b) => a.period.localeCompare(b.period)).slice(-6);
  }, [visibleIncomes]);

  const totalPages = Math.max(1, Math.ceil(visibleIncomes.length / PAGE_SIZE));
  const paginatedIncomes = visibleIncomes.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => setPage(1), [filterStatus, filterStartDate, filterEndDate, query]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const fields = [
    { name: 'date', label: 'Fecha de ingreso', type: 'date', required: true, defaultValue: todayIso() },
    { name: 'concept', label: 'Concepto', type: 'text', required: true },
    { name: 'amount', label: 'Monto', type: 'number', required: true, min: '0', step: '0.01' },
    { name: 'source', label: 'Origen', type: 'text', placeholder: 'Ej. Arriendo salón comunal' },
    { name: 'category', label: 'Categoría', type: 'select', options: CATEGORY_OPTIONS },
    { name: 'method', label: 'Método', type: 'select', options: METHOD_OPTIONS },
    { name: 'reference', label: 'Referencia', type: 'text' },
    { name: 'period', label: 'Período aplicable', type: 'month', defaultValue: currentMonth() },
    {
      name: 'owner_id',
      label: 'Propietario relacionado',
      type: 'select',
      options: owners.map((owner) => ({ value: owner.id, label: owner.full_name })),
    },
    {
      name: 'apartment_id',
      label: 'Departamento relacionado',
      type: 'select',
      options: apartments.map((apartment) => ({ value: apartment.id, label: `Depto ${apartment.code}` })),
    },
  ];

  const handleCreate = async (data) => {
    try {
      const payload = Object.fromEntries(
        Object.entries({
          ...data,
          amount: Number(data.amount),
        }).filter(([, value]) => value !== '' && value !== null && value !== undefined)
      );
      await createIncome(payload);
      success('Ingreso registrado con éxito');
      setIsFormOpen(false);
      await fetchIncomes(fetchParams);
    } catch (err) {
      toastError(formatApiError(err, 'Error al registrar ingreso'));
    }
  };

  const handleAnnul = async () => {
    setActionError(null);
    try {
      await annulIncome(annulTarget.id);
      success('Ingreso anulado con éxito');
      await fetchIncomes(fetchParams);
    } catch (err) {
      const msg = formatApiError(err, 'Error al anular ingreso');
      setActionError(msg);
      toastError(msg);
    } finally {
      setAnnulTarget(null);
    }
  };

  const handleExport = async (format) => {
    setExportingReport(format);
    setActionError(null);
    try {
      const blob = await downloadIncomeReport(token, { ...fetchParams, format });
      triggerDownload(blob, `reporte-ingresos-${filterStartDate || 'todos'}-${filterEndDate || 'actual'}.${format === 'excel' ? 'xlsx' : format}`);
      success(`Reporte de ingresos descargado en ${format === 'excel' ? 'Excel' : format.toUpperCase()}`);
    } catch (err) {
      const msg = formatApiError(err, 'Error al descargar el reporte de ingresos');
      setActionError(msg);
      toastError(msg);
    } finally {
      setExportingReport(null);
    }
  };

  const visibleError = error || actionError;

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <div className={styles.breadcrumb}>Admin / Ingresos</div>
          <h1 className={styles.title}>Gestión de Ingresos</h1>
          <p className={styles.subtitle}>
            Registro de ingresos adicionales y movimientos relacionados a departamentos para reportes y estados de cuenta.
          </p>
        </div>
        <div className={styles.headerActions}>
          <select className={styles.select} value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)} aria-label="Filtrar estado">
            {STATUS_FILTERS.map((option) => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}
          </select>
          <label className={styles.dateField}>
            <span>Inicio</span>
            <input type="date" value={filterStartDate} onChange={(event) => setFilterStartDate(event.target.value)} />
          </label>
          <label className={styles.dateField}>
            <span>Fin</span>
            <input type="date" value={filterEndDate} onChange={(event) => setFilterEndDate(event.target.value)} />
          </label>
          <div className={styles.reportActions}>
            <button type="button" className={styles.btnReport} onClick={() => handleExport('pdf')} disabled={exportingReport === 'pdf'}>
              <DownloadIcon />
              {exportingReport === 'pdf' ? 'Generando...' : 'PDF'}
            </button>
            <button type="button" className={styles.btnReportSecondary} onClick={() => handleExport('excel')} disabled={exportingReport === 'excel'}>
              <DownloadIcon />
              {exportingReport === 'excel' ? 'Generando...' : 'Excel'}
            </button>
          </div>
          <button type="button" className={styles.btnPrimary} onClick={() => setIsFormOpen(true)}>
            + Registrar ingreso
          </button>
        </div>
      </section>

      {visibleError && <div className={styles.errorBanner}>{formatApiError(visibleError)}</div>}

      <section className={styles.metricsGrid}>
        <article className={styles.metricCard}>
          <div className={styles.metricTopline}>
            <span className={styles.iconCircle}>$</span>
            <span className={styles.metricTag}>Registrados</span>
          </div>
          <span className={styles.metricLabel}>Total ingresos</span>
          <strong className={styles.metricValue}>{formatCurrency(totalRegistered)}</strong>
          <span className={styles.metricFoot}>{registeredIncomes.length} movimientos visibles</span>
        </article>
        <article className={`${styles.metricCard} ${styles.warningCard}`}>
          <div className={styles.metricTopline}>
            <span className={styles.iconCircle}>!</span>
            <span className={styles.metricTag}>Anulados</span>
          </div>
          <span className={styles.metricLabel}>Ingresos anulados</span>
          <strong className={styles.metricValue}>{annulledIncomes.length}</strong>
          <span className={styles.metricFoot}>{formatCurrency(totalAnnulled)} fuera del balance</span>
        </article>
        <article className={styles.metricCard}>
          <div className={styles.metricTopline}>
            <span className={styles.iconCircle}>#</span>
            <span className={styles.dotLabel}>Clasificación</span>
          </div>
          <span className={styles.metricLabel}>Categorías activas</span>
          <strong className={styles.metricValue}>{categoryData.length}</strong>
          <span className={styles.metricFoot}>Origen de ingresos consolidados</span>
        </article>
      </section>

      <section className={styles.dashboardGrid}>
        <div className={styles.mainColumn}>
          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <h2>Tendencia de ingresos</h2>
                <p>Movimientos registrados y anulados por período.</p>
              </div>
            </div>
            {trendData.length ? (
              <div className={styles.chartBox}>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={trendData} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="period" tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={(value) => `$${Number(value).toLocaleString()}`} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Bar dataKey="registrado" name="Registrado" fill="#0b5bd3" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="anulado" name="Anulado" fill="#ef4444" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className={styles.emptyState}>No hay ingresos para graficar.</div>
            )}
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <h2>Historial de ingresos</h2>
                <p>{visibleIncomes.length} registros según los filtros actuales.</p>
              </div>
              <input
                className={styles.searchInput}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar concepto, origen, propietario o referencia"
              />
            </div>
            {loading ? (
              <div className={styles.emptyState}>Cargando ingresos...</div>
            ) : visibleIncomes.length ? (
              <>
                <div className={styles.tableWrap}>
                  <table className={styles.paymentsTable}>
                    <thead>
                      <tr>
                        <th>Concepto / Origen</th>
                        <th>Fecha</th>
                        <th>Monto</th>
                        <th>Relación</th>
                        <th>Estado</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedIncomes.map((income) => {
                        const status = STATUS_CONFIG[income.status] || { label: income.status, className: 'statusDefault' };
                        return (
                          <tr key={income.id}>
                            <td>
                              <strong>{income.concept}</strong>
                              <span>{income.category || income.source || 'Sin categoría'}</span>
                              {income.reference && <small>Ref. {income.reference}</small>}
                            </td>
                            <td>
                              <strong>{formatDate(income.date)}</strong>
                              <span>{income.period || 'Sin período'}</span>
                            </td>
                            <td className={styles.amountCell}>{formatCurrency(income.amount)}</td>
                            <td>
                              <strong>{income.apartment_code ? `Unidad ${income.apartment_code}` : 'General'}</strong>
                              <span>{income.owner_name || 'Sin propietario'}</span>
                            </td>
                            <td>
                              <span className={`${styles.statusBadge} ${styles[status.className]}`}>{status.label}</span>
                            </td>
                            <td className={styles.actionCell}>
                              <button className={styles.btnTable} disabled={income.status !== 'REGISTRADO'} onClick={() => setAnnulTarget(income)}>
                                Anular
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (
                  <div className={styles.pagination} aria-label="Paginación de ingresos">
                    <button type="button" className={styles.btnSecondary} onClick={() => setPage(page - 1)} disabled={page === 1}>Anterior</button>
                    <span className={styles.paginationInfo}>Página {page} de {totalPages}</span>
                    <button type="button" className={styles.btnSecondary} onClick={() => setPage(page + 1)} disabled={page === totalPages}>Siguiente</button>
                  </div>
                )}
              </>
            ) : (
              <div className={styles.emptyState}>No hay ingresos registrados.</div>
            )}
          </article>
        </div>

        <aside className={styles.sideColumn}>
          <article className={styles.panel}>
            <h2>Categorías</h2>
            {categoryData.length ? (
              <div className={styles.methodList}>
                {categoryData.map((item) => (
                  <div className={styles.methodRow} key={item.label}>
                    <div><strong>{item.label}</strong></div>
                    <span>{formatCurrency(item.total)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyStateSmall}>Sin categorías registradas.</div>
            )}
          </article>
          <article className={styles.panel}>
            <h2>Resumen operativo</h2>
            <div className={styles.summaryRows}>
              <div><span>Registros visibles</span><strong>{visibleIncomes.length}</strong></div>
              <div><span>Registrados</span><strong>{registeredIncomes.length}</strong></div>
              <div><span>Anulados</span><strong>{annulledIncomes.length}</strong></div>
            </div>
          </article>
        </aside>
      </section>

      <FormModal
        isOpen={isFormOpen}
        title="Registrar ingreso"
        fields={fields}
        onSubmit={handleCreate}
        onClose={() => setIsFormOpen(false)}
      />

      <ConfirmDialog
        isOpen={!!annulTarget}
        message={`¿Anular el ingreso de ${formatCurrency(annulTarget?.amount)}?`}
        confirmLabel="Anular"
        onConfirm={handleAnnul}
        onCancel={() => setAnnulTarget(null)}
      />
    </div>
  );
}

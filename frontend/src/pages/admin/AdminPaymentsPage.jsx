import { useState, useEffect, useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { usePayments } from '../../hooks/usePayments';
import { useAdminPaymentReview } from '../../hooks/useAdminPaymentReview';
import { useApartments } from '../../hooks/useApartments';
import { useOwners } from '../../hooks/useOwners';
import { useAuth } from '../../hooks/useAuth';
import { getApartmentPendingDebts } from '../../services/apartmentService';
import { downloadPaymentsReport } from '../../services/reportService';
import FormModal from '../../components/FormModal/FormModal';
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog';
import PaymentReviewModal from '../../components/PaymentReviewModal/PaymentReviewModal';
import DownloadIcon from '../../components/icons/DownloadIcon';
import { formatApiError } from '../../utils/apiError';
import styles from './AdminPaymentsPage.module.css';

const STATUS_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'REGISTRADO', label: 'Pagados' },
  { value: 'ANULADO', label: 'Anulados' },
];

const METHOD_OPTIONS = [
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'cheque', label: 'Cheque' },
];

const VIEW_TABS = [
  { value: 'overview', label: 'Resumen y pagos' },
  { value: 'approvals', label: 'Aprobaciones' },
];

const PAGE_SIZE = 5;

const STATUS_CONFIG = {
  REGISTRADO: { label: 'Pagado', className: 'statusPaid' },
  ANULADO: { label: 'Anulado', className: 'statusAnnulled' },
};

const METHOD_COLORS = ['#0b5bd3', '#16a34a', '#d97706', '#64748b'];

const getCurrentMonth = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
};

const getCurrentMonthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
};

const triggerDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const formatCurrency = (value) => `$${Number(value || 0).toLocaleString(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

const formatDate = (value) => {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`));
};

const formatMethod = (method) => {
  if (!method) return 'Sin método';
  return METHOD_OPTIONS.find((option) => option.value === method)?.label || method;
};

const getPeriodLabel = (period) => {
  if (!period) return 'Sin período';
  const [year, month] = period.split('-');
  return new Intl.DateTimeFormat('es', { month: 'short', year: '2-digit' })
    .format(new Date(Number(year), Number(month) - 1, 1));
};

import { useNotification } from '../../context/NotificationContext';

export default function AdminPaymentsPage() {
  const initialRange = useMemo(() => getCurrentMonthRange(), []);
  const { payments, loading, error, fetchPayments, createPayment, annulPayment, downloadAdminReceipt } = usePayments();
  const {
    pendingPayments,
    loading: loadingPending,
    error: errorPending,
    fetchPending,
    approvePayment,
    rejectPayment,
    downloadProof,
  } = useAdminPaymentReview();
  const { success, error: toastError } = useNotification();
  const { apartments, fetchApartments } = useApartments();
  const { owners, fetchOwners } = useOwners();
  const { token } = useAuth();
  const [formPendingDebts, setFormPendingDebts] = useState({ cuotas: [], multas: [] });
  const [selectedApartmentId, setSelectedApartmentId] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [annulTarget, setAnnulTarget] = useState(null);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterStartDate, setFilterStartDate] = useState(initialRange.startDate);
  const [filterEndDate, setFilterEndDate] = useState(initialRange.endDate);
  const [query, setQuery] = useState('');
  const [activeView, setActiveView] = useState('overview');
  const [actionError, setActionError] = useState(null);
  const [exportingReport, setExportingReport] = useState(null);
  const [filteredApartments, setFilteredApartments] = useState([]);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [pendingPage, setPendingPage] = useState(1);

  const getPaymentFetchParams = () => {
    const params = {};
    if (filterStatus) params.status = filterStatus;
    return params;
  };

  useEffect(() => {
    fetchApartments();
    fetchOwners();
    fetchPending();
  }, [fetchApartments, fetchOwners, fetchPending]);

  useEffect(() => {
    fetchPayments(getPaymentFetchParams());
  }, [filterStatus, fetchPayments]);

  const visiblePayments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return payments.filter((payment) => {
      if (filterStartDate && (!payment.paid_at || payment.paid_at < filterStartDate)) return false;
      if (filterEndDate && (!payment.paid_at || payment.paid_at > filterEndDate)) return false;
      if (!normalizedQuery) return true;
      return [
        payment.period,
        payment.apartment_code,
        payment.owner_name,
        payment.method,
        payment.reference,
        payment.status,
      ].some((value) => String(value || '').toLowerCase().includes(normalizedQuery));
    });
  }, [payments, query, filterStartDate, filterEndDate]);

  const registeredPayments = useMemo(
    () => visiblePayments.filter((payment) => payment.status === 'REGISTRADO'),
    [visiblePayments]
  );

  const paginatedVisiblePayments = useMemo(() => {
    const start = (paymentsPage - 1) * PAGE_SIZE;
    return visiblePayments.slice(start, start + PAGE_SIZE);
  }, [paymentsPage, visiblePayments]);

  const paginatedPendingPayments = useMemo(() => {
    const start = (pendingPage - 1) * PAGE_SIZE;
    return pendingPayments.slice(start, start + PAGE_SIZE);
  }, [pendingPage, pendingPayments]);

  const paymentsTotalPages = Math.max(1, Math.ceil(visiblePayments.length / PAGE_SIZE));
  const pendingTotalPages = Math.max(1, Math.ceil(pendingPayments.length / PAGE_SIZE));

  const annulledPayments = useMemo(
    () => visiblePayments.filter((payment) => payment.status === 'ANULADO'),
    [visiblePayments]
  );

  const totalCollected = useMemo(
    () => registeredPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    [registeredPayments]
  );

  const totalAnnulled = useMemo(
    () => annulledPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    [annulledPayments]
  );

  const monthlyData = useMemo(() => {
    const map = new Map();
    visiblePayments.forEach((payment) => {
      if (!payment.period) return;
      const current = map.get(payment.period) || { period: payment.period, recaudado: 0, anulados: 0 };
      if (payment.status === 'ANULADO') {
        current.anulados += Number(payment.amount || 0);
      } else {
        current.recaudado += Number(payment.amount || 0);
      }
      map.set(payment.period, current);
    });

    return [...map.values()]
      .sort((a, b) => a.period.localeCompare(b.period))
      .slice(-6)
      .map((item) => ({ ...item, label: getPeriodLabel(item.period) }));
  }, [visiblePayments]);

  const methodData = useMemo(() => {
    const map = new Map();
    registeredPayments.forEach((payment) => {
      const method = payment.method || 'sin_metodo';
      const current = map.get(method) || { method, label: formatMethod(method), total: 0, count: 0 };
      current.total += Number(payment.amount || 0);
      current.count += 1;
      map.set(method, current);
    });
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [registeredPayments]);

  const referencedPayments = useMemo(
    () => visiblePayments.filter((payment) => Boolean(payment.reference)).slice(0, 4),
    [visiblePayments]
  );

  useEffect(() => {
    setPaymentsPage(1);
  }, [filterStatus, filterStartDate, filterEndDate, query]);

  useEffect(() => {
    if (paymentsPage > paymentsTotalPages) {
      setPaymentsPage(paymentsTotalPages);
    }
  }, [paymentsPage, paymentsTotalPages]);

  useEffect(() => {
    if (pendingPage > pendingTotalPages) {
      setPendingPage(pendingTotalPages);
    }
  }, [pendingPage, pendingTotalPages]);

  const completionRate = visiblePayments.length
    ? Math.round((registeredPayments.length / visiblePayments.length) * 100)
    : 0;
  const visibleError = error || actionError || errorPending;

  const handleApartmentChange = (apartmentId) => {
    const selectedApartment = apartments.find((a) => String(a.id) === String(apartmentId));
    setSelectedApartmentId(apartmentId);
    if (apartmentId) {
      getApartmentPendingDebts(token, apartmentId)
        .then((data) => setFormPendingDebts(data))
        .catch(() => setFormPendingDebts({ cuotas: [], multas: [] }));
    } else {
      setFormPendingDebts({ cuotas: [], multas: [] });
    }
    return {
      owner_id: selectedApartment?.owner_id || '',
      selected_debt: '',
      fine_id: '',
    };
  };

  const handleOwnerChange = (ownerId) => {
    const filtered = apartments.filter((a) => String(a.owner_id) === String(ownerId));
    setFilteredApartments(filtered);
    const hasSingleApartment = filtered.length === 1;
    const aptId = hasSingleApartment ? filtered[0].id : '';
    setSelectedApartmentId(aptId);
    if (aptId) {
      getApartmentPendingDebts(token, aptId)
        .then((data) => setFormPendingDebts(data))
        .catch(() => setFormPendingDebts({ cuotas: [], multas: [] }));
    } else {
      setFormPendingDebts({ cuotas: [], multas: [] });
    }
    return {
      owner_id: ownerId,
      apartment_id: aptId,
      selected_debt: '',
      fine_id: '',
    };
  };

  const handleDebtChangeSelection = (selectedVal) => {
    if (!selectedVal) {
      return {
        period: getCurrentMonth(),
        amount: '',
        fine_id: '',
      };
    }
    const [type, id] = selectedVal.split(':');
    if (type === 'cuota') {
      const selected = formPendingDebts.cuotas.find((c) => c.id === id);
      if (selected) {
        return {
          period: selected.period,
          amount: selected.amount.toString(),
          fine_id: '',
        };
      }
    } else if (type === 'multas') {
      const selected = formPendingDebts.multas.find((m) => m.id === id);
      if (selected) {
        return {
          period: selected.period,
          amount: selected.amount.toString(),
          fine_id: selected.id,
        };
      }
    }
    return null;
  };

  const getPaymentFields = () => {
    const debtOptions = [];
    if (formPendingDebts.cuotas.length > 0) {
      debtOptions.push({
        label: 'Cuotas pendientes',
        options: formPendingDebts.cuotas.map((c) => ({
          value: `cuota:${c.id}`,
          label: `${c.description} (${formatCurrency(c.amount)})`,
        })),
      });
    }
    if (formPendingDebts.multas.length > 0) {
      debtOptions.push({
        label: 'Multas activas',
        options: formPendingDebts.multas.map((m) => ({
          value: `multas:${m.id}`,
          label: `${m.description} (${formatCurrency(m.amount)})`,
        })),
      });
    }

    return [
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
      ...(selectedApartmentId
        ? [
            {
              name: 'selected_debt',
              label: 'Concepto / Deuda Pendiente',
              type: 'select',
              options: debtOptions,
              onChange: handleDebtChangeSelection,
            },
          ]
        : []),
      { name: 'fine_id', type: 'hidden' },
      { name: 'period', label: 'Período (YYYY-MM)', type: 'month', required: true, defaultValue: getCurrentMonth() },
      { name: 'amount', label: 'Monto', type: 'number', required: true, min: '0', step: '0.01' },
      {
        name: 'method',
        label: 'Método de pago',
        type: 'select',
        options: METHOD_OPTIONS,
      },
      { name: 'reference', label: 'Referencia / Comprobante', type: 'text' },
      { name: 'paid_at', label: 'Fecha de pago', type: 'date', required: true },
    ];
  };

  const handleCreate = async (data) => {
    try {
      const { selected_debt: _selectedDebt, fine_id, method, reference, ...paymentData } = data;
      const payload = {
        ...paymentData,
        amount: parseFloat(data.amount),
        ...(method ? { method } : {}),
        ...(reference ? { reference } : {}),
        ...(fine_id ? { fine_id } : {}),
      };

      await createPayment(payload);
      success('Pago registrado con éxito');
      setIsFormOpen(false);
      setFilteredApartments([]);
      setSelectedApartmentId('');
      setFormPendingDebts({ cuotas: [], multas: [] });
      setPaymentsPage(1);
      await fetchPayments(getPaymentFetchParams());
    } catch (err) {
      toastError(formatApiError(err, 'Error al registrar pago'));
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setFilteredApartments([]);
    setSelectedApartmentId('');
    setFormPendingDebts({ cuotas: [], multas: [] });
  };

  const handleAnnul = async () => {
    setActionError(null);
    try {
      await annulPayment(annulTarget.id);
      success('Pago anulado con éxito');
      await fetchPayments(getPaymentFetchParams());
    } catch (err) {
      const msg = formatApiError(err, 'Error al anular pago');
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
      const params = {
        format,
        ...(filterStatus ? { status_filter: filterStatus } : {}),
        ...(filterStartDate ? { start_date: filterStartDate } : {}),
        ...(filterEndDate ? { end_date: filterEndDate } : {}),
      };
      const blob = await downloadPaymentsReport(token, params);
      const ext = format === 'excel' ? 'xlsx' : 'pdf';
      triggerDownload(blob, `reporte-pagos-${filterStartDate || 'todos'}-${filterEndDate || 'actual'}.${ext}`);
      success(`Reporte de pagos descargado en ${format === 'excel' ? 'Excel' : 'PDF'}`);
    } catch (err) {
      const msg = formatApiError(err, 'Error al descargar el reporte de pagos');
      setActionError(msg);
      toastError(msg);
    } finally {
      setExportingReport(null);
    }
  };

  const handleDownloadProof = async (payment) => {
    const proofBlob = await downloadProof(payment.id);
    const url = URL.createObjectURL(proofBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = payment.proof_file_name || `comprobante-${payment.id}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const renderPagination = (page, totalPages, onChange, label) => {
    if (totalPages <= 1) return null;

    return (
      <div className={styles.pagination} aria-label={`Paginación de ${label}`}>
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
        >
          Anterior
        </button>
        <span className={styles.paginationInfo}>Página {page} de {totalPages}</span>
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
        >
          Siguiente
        </button>
      </div>
    );
  };

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <div className={styles.breadcrumb}>Admin / Pagos</div>
          <h1 className={styles.title}>Gestión de Pagos</h1>
          <p className={styles.subtitle}>
            Control de pagos registrados y anulados con datos reales de departamentos, propietarios y métodos.
          </p>
        </div>
        <div className={styles.headerActions}>
          <select
            className={styles.select}
            value={filterStatus}
            onChange={(event) => setFilterStatus(event.target.value)}
            aria-label="Filtrar estado"
          >
            {STATUS_FILTERS.map((option) => (
              <option key={option.value || 'all'} value={option.value}>{option.label}</option>
            ))}
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
            + Registrar pago
          </button>
        </div>
      </section>

      {visibleError && (
        <div className={styles.errorBanner}>{formatApiError(visibleError)}</div>
      )}

      <section className={styles.tabsSection}>
        <div className={styles.tabsList} role="tablist" aria-label="Secciones de pagos">
          {VIEW_TABS.map((tab) => {
            const isActive = activeView === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`payments-panel-${tab.value}`}
                id={`payments-tab-${tab.value}`}
                className={`${styles.tabButton} ${isActive ? styles.tabButtonActive : ''}`}
                onClick={() => setActiveView(tab.value)}
              >
                <span>{tab.label}</span>
                {tab.value === 'approvals' && pendingPayments.length > 0 && (
                  <span className={styles.pendingBadge}>{pendingPayments.length}</span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section
        id="payments-panel-approvals"
        role="tabpanel"
        aria-labelledby="payments-tab-approvals"
        hidden={activeView !== 'approvals'}
      >
        <section className={styles.pendingSection}>
          <h2 className={styles.pendingSectionTitle}>
            Pendientes de aprobación
            {pendingPayments.length > 0 && (
              <span className={styles.pendingBadge}>{pendingPayments.length}</span>
            )}
          </h2>
          {loadingPending ? (
            <div className={styles.emptyState}>Cargando pendientes...</div>
          ) : pendingPayments.length ? (
            <>
            <div className={styles.tableWrap}>
              <table className={styles.paymentsTable}>
                <thead>
                  <tr>
                    <th>Departamento / Propietario</th>
                    <th>Período</th>
                    <th>Monto</th>
                    <th>Comprobante</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPendingPayments.map((payment) => (
                    <tr key={payment.id}>
                      <td>
                        <strong>Unidad {payment.apartment_code || 'N/D'}</strong>
                        <span>{payment.owner_name || 'Sin propietario'}</span>
                      </td>
                      <td>{payment.period}</td>
                      <td className={styles.amountCell}>{formatCurrency(payment.amount)}</td>
                      <td>{payment.proof_file_name || '—'}</td>
                      <td>
                        <button
                          className={styles.btnPrimary}
                          onClick={() => setReviewTarget(payment)}
                        >
                          Revisar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {renderPagination(pendingPage, pendingTotalPages, setPendingPage, 'aprobaciones')}
            </>
          ) : (
            <div className={styles.emptyState}>No hay pagos pendientes por aprobar.</div>
          )}
        </section>
      </section>

      <section
        id="payments-panel-overview"
        role="tabpanel"
        aria-labelledby="payments-tab-overview"
        hidden={activeView !== 'overview'}
      >
      <section className={styles.metricsGrid}>
        <article className={styles.metricCard}>
          <div className={styles.metricTopline}>
            <span className={styles.iconCircle}>$</span>
            <span className={styles.metricTag}>{filterStartDate || filterEndDate ? 'Rango' : 'Todos'}</span>
          </div>
          <span className={styles.metricLabel}>Total recaudado</span>
          <strong className={styles.metricValue}>{formatCurrency(totalCollected)}</strong>
          <span className={styles.metricFoot}>{registeredPayments.length} pagos registrados</span>
        </article>

        <article className={`${styles.metricCard} ${styles.warningCard}`}>
          <div className={styles.metricTopline}>
            <span className={styles.iconCircle}>!</span>
            <span className={styles.metricTag}>Anulados</span>
          </div>
          <span className={styles.metricLabel}>Pagos anulados</span>
          <strong className={styles.metricValue}>{annulledPayments.length}</strong>
          <span className={styles.metricFoot}>{formatCurrency(totalAnnulled)} fuera de recaudo</span>
        </article>

        <article className={styles.metricCard}>
          <div className={styles.metricTopline}>
            <span className={styles.iconCircle}>%</span>
            <span className={styles.dotLabel}>Estado real</span>
          </div>
          <span className={styles.metricLabel}>Cumplimiento registrado</span>
          <strong className={styles.metricValue}>{completionRate}%</strong>
          <div className={styles.progressTrack}>
            <span style={{ width: `${completionRate}%` }} />
          </div>
        </article>
      </section>

      <section className={styles.dashboardGrid}>
        <div className={styles.mainColumn}>
          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <h2>Tendencia mensual</h2>
                <p>Recaudado y anulado según los pagos cargados.</p>
              </div>
            </div>
            {monthlyData.length ? (
              <div className={styles.chartBox}>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={monthlyData} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={(value) => `$${Number(value).toLocaleString()}`} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Bar dataKey="recaudado" name="Recaudado" fill="#0b5bd3" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="anulados" name="Anulado" fill="#ef4444" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className={styles.emptyState}>No hay pagos para graficar.</div>
            )}
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <h2>Historial de pagos recientes</h2>
                <p>{visiblePayments.length} registros según los filtros actuales.</p>
              </div>
              <input
                className={styles.searchInput}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar departamento, propietario o referencia"
              />
            </div>

            {loading ? (
              <div className={styles.emptyState}>Cargando pagos...</div>
            ) : visiblePayments.length ? (
              <>
                <div className={styles.tableWrap}>
                  <table className={styles.paymentsTable}>
                    <thead>
                      <tr>
                        <th>Departamento / Propietario</th>
                        <th>Fecha</th>
                        <th>Monto</th>
                        <th>Método</th>
                        <th>Estado</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedVisiblePayments.map((payment) => {
                        const status = STATUS_CONFIG[payment.status] || { label: payment.status, className: 'statusDefault' };
                        return (
                          <tr key={payment.id}>
                            <td>
                              <strong>Unidad {payment.apartment_code || 'N/D'}</strong>
                              <span>{payment.owner_name || 'Sin propietario'}</span>
                              {payment.reference && <small>Ref. {payment.reference}</small>}
                            </td>
                            <td>
                              <strong>{formatDate(payment.paid_at)}</strong>
                              <span>{payment.period}</span>
                            </td>
                            <td className={styles.amountCell}>{formatCurrency(payment.amount)}</td>
                            <td><span className={styles.methodPill}>{formatMethod(payment.method)}</span></td>
                            <td>
                              <span className={`${styles.statusBadge} ${styles[status.className]}`}>
                                {status.label}
                              </span>
                            </td>
                            <td className={styles.actionCell}>
                              <button
                                className={styles.btnAction}
                                onClick={async () => {
                                  try {
                                    const blob = await downloadAdminReceipt(payment.id);
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `recibo_${payment.id}.pdf`;
                                    a.click();
                                    URL.revokeObjectURL(url);
                                  } catch (e) {
                                    alert('El recibo oficial solo está disponible para pagos aprobados/registrados');
                                  }
                                }}
                                title="Descargar recibo oficial"
                              >
                                Recibo
                              </button>
                              <button
                                className={styles.btnTable}
                                disabled={payment.status !== 'REGISTRADO'}
                                onClick={() => setAnnulTarget(payment)}
                              >
                                Anular
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {renderPagination(paymentsPage, paymentsTotalPages, setPaymentsPage, 'historial de pagos')}
              </>
            ) : (
              <div className={styles.emptyState}>No hay pagos registrados.</div>
            )}
          </article>
        </div>

        <aside className={styles.sideColumn}>
          <article className={styles.panel}>
            <h2>Métodos de pago</h2>
            {methodData.length ? (
              <div className={styles.methodList}>
                {methodData.map((item, index) => (
                  <div className={styles.methodRow} key={item.method}>
                    <div>
                      <span className={styles.colorDot} style={{ background: METHOD_COLORS[index % METHOD_COLORS.length] }} />
                      <strong>{item.label}</strong>
                    </div>
                    <span>{formatCurrency(item.total)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyStateSmall}>Sin métodos registrados.</div>
            )}
          </article>

          <article className={styles.panel}>
            <h2>Comprobantes y referencias</h2>
            {referencedPayments.length ? (
              <div className={styles.referenceList}>
                {referencedPayments.map((payment) => (
                  <div className={styles.referenceItem} key={payment.id}>
                    <strong>Unidad {payment.apartment_code || 'N/D'}</strong>
                    <span>{payment.reference}</span>
                    <small>{formatCurrency(payment.amount)} · {formatMethod(payment.method)}</small>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyStateSmall}>No hay referencias guardadas.</div>
            )}
          </article>

          <article className={styles.panel}>
            <h2>Resumen operativo</h2>
            <div className={styles.summaryRows}>
              <div><span>Registros visibles</span><strong>{visiblePayments.length}</strong></div>
              <div><span>Pagados</span><strong>{registeredPayments.length}</strong></div>
              <div><span>Anulados</span><strong>{annulledPayments.length}</strong></div>
            </div>
          </article>
        </aside>
      </section>
      </section>

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

      <PaymentReviewModal
        payment={reviewTarget}
        onDownloadProof={handleDownloadProof}
        onApprove={async (id) => {
          try {
            await approvePayment(id);
            success('Pago aprobado con éxito');
            setReviewTarget(null);
            await Promise.all([
              fetchPending(),
              fetchPayments(getPaymentFetchParams()),
            ]);
          } catch (err) {
            toastError(formatApiError(err, 'Error al aprobar pago'));
          }
        }}
        onReject={async (id, reason) => {
          try {
            await rejectPayment(id, reason);
            success('Pago rechazado con éxito');
            setReviewTarget(null);
            await Promise.all([
              fetchPending(),
              fetchPayments(getPaymentFetchParams()),
            ]);
          } catch (err) {
            toastError(formatApiError(err, 'Error al rechazar pago'));
          }
        }}
        onClose={() => setReviewTarget(null)}
      />
    </div>
  );
}

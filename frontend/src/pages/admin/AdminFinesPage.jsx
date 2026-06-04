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
import { useFines } from '../../hooks/useFines';
import { useApartments } from '../../hooks/useApartments';
import { useOwners } from '../../hooks/useOwners';
import FormModal from '../../components/FormModal/FormModal';
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog';
import PeriodSelector from '../../components/PeriodSelector/PeriodSelector';
import styles from './AdminFinesPage.module.css';

const PAGE_SIZE = 8;

const STATUS_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'ACTIVA', label: 'Activas' },
  { value: 'ANULADA', label: 'Anuladas' },
];

const STATUS_CONFIG = {
  ACTIVA: { label: 'Activa', className: 'statusActive' },
  ANULADA: { label: 'Anulada', className: 'statusAnnulled' },
};

const getCurrentMonth = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
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

const getPeriodLabel = (period) => {
  if (!period) return 'Sin período';
  const [year, month] = period.split('-');
  return new Intl.DateTimeFormat('es', { month: 'short', year: '2-digit' })
    .format(new Date(Number(year), Number(month) - 1, 1));
};

const getStatsFallback = (fines) => {
  const active = fines.filter((fine) => fine.status === 'ACTIVA');
  const annulled = fines.filter((fine) => fine.status === 'ANULADA');
  const reasonMap = new Map();
  const monthMap = new Map();

  fines.forEach((fine) => {
    const reason = fine.reason || 'Sin motivo';
    const currentReason = reasonMap.get(reason) || { reason, count: 0, amount: 0 };
    currentReason.count += 1;
    currentReason.amount += Number(fine.amount || 0);
    reasonMap.set(reason, currentReason);

    const currentMonth = monthMap.get(fine.period) || { period: fine.period, count: 0, amount: 0 };
    currentMonth.count += 1;
    currentMonth.amount += Number(fine.amount || 0);
    monthMap.set(fine.period, currentMonth);
  });

  return {
    totals: {
      total_count: fines.length,
      total_amount: fines.reduce((sum, fine) => sum + Number(fine.amount || 0), 0),
      active_count: active.length,
      active_amount: active.reduce((sum, fine) => sum + Number(fine.amount || 0), 0),
      annulled_count: annulled.length,
      annulled_amount: annulled.reduce((sum, fine) => sum + Number(fine.amount || 0), 0),
    },
    monthly: [...monthMap.values()].sort((a, b) => a.period.localeCompare(b.period)).slice(-6),
    reasons: [...reasonMap.values()].sort((a, b) => b.count - a.count).slice(0, 8),
  };
};

import { useNotification } from '../../context/NotificationContext';

export default function AdminFinesPage() {
  const {
    fines,
    fineStats,
    pagination,
    loading,
    error,
    fetchFines,
    fetchFineStats,
    createFine,
    annulFine,
  } = useFines();
  const { success, error: toastError } = useNotification();
  const { apartments, fetchApartments } = useApartments();
  const { owners, fetchOwners } = useOwners();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [annulTarget, setAnnulTarget] = useState(null);
  const [filterPeriod, setFilterPeriod] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterReason, setFilterReason] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [actionError, setActionError] = useState(null);
  const [filteredApartments, setFilteredApartments] = useState([]);

  useEffect(() => {
    fetchApartments();
    fetchOwners();
  }, [fetchApartments, fetchOwners]);

  const filters = useMemo(() => {
    const params = {};
    if (filterPeriod) params.period = filterPeriod;
    if (filterStatus) params.status = filterStatus;
    if (filterReason) params.reason = filterReason;
    if (query.trim()) params.search = query.trim();
    return params;
  }, [filterPeriod, filterStatus, filterReason, query]);

  useEffect(() => {
    setPage(1);
  }, [filterPeriod, filterStatus, filterReason, query]);

  useEffect(() => {
    fetchFines({ ...filters, page, page_size: PAGE_SIZE });
    if (typeof fetchFineStats === 'function') {
      fetchFineStats(filters);
    }
  }, [filters, page, fetchFines, fetchFineStats]);

  const stats = fineStats || getStatsFallback(fines);
  const totals = stats.totals || {};
  const reasonOptions = useMemo(
    () => (stats.reasons || []).map((item) => item.reason).filter(Boolean),
    [stats.reasons]
  );
  const monthlyData = useMemo(
    () => (stats.monthly || []).map((item) => ({
      ...item,
      label: getPeriodLabel(item.period),
      amount: Number(item.amount || 0),
    })),
    [stats.monthly]
  );
  const topReason = (stats.reasons || [])[0];
  const totalPages = pagination?.total_pages || 1;

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
    { name: 'period', label: 'Período (YYYY-MM)', type: 'month', required: true, defaultValue: getCurrentMonth() },
    { name: 'amount', label: 'Monto', type: 'number', required: true, min: '0', step: '0.01' },
    { name: 'reason', label: 'Motivo', type: 'textarea', required: true },
    { name: 'issued_at', label: 'Fecha de emisión', type: 'date', required: true },
  ];

  const handleCreate = async (data) => {
    try {
      await createFine({ ...data, amount: parseFloat(data.amount) });
      success('Multa registrada con éxito');
      setIsFormOpen(false);
      setFilteredApartments([]);
      fetchFines({ ...filters, page, page_size: PAGE_SIZE });
      if (typeof fetchFineStats === 'function') fetchFineStats(filters);
    } catch (err) {
      toastError(err.response?.data?.detail || 'Error al registrar multa');
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setFilteredApartments([]);
  };

  const handleAnnul = async () => {
    setActionError(null);
    try {
      await annulFine(annulTarget.id);
      success('Multa anulada con éxito');
      fetchFines({ ...filters, page, page_size: PAGE_SIZE });
      if (typeof fetchFineStats === 'function') fetchFineStats(filters);
    } catch (err) {
      const msg = err.response?.data?.detail || 'Error al anular multa';
      setActionError(msg);
      toastError(msg);
    } finally {
      setAnnulTarget(null);
    }
  };

  const clearFilters = () => {
    setFilterPeriod('');
    setFilterStatus('');
    setFilterReason('');
    setQuery('');
  };

  const handleExport = () => {
    const headers = ['periodo', 'departamento', 'propietario', 'motivo', 'monto', 'fecha_emision', 'estado'];
    const rows = fines.map((fine) => [
      fine.period,
      fine.apartment_code,
      fine.owner_name,
      fine.reason,
      fine.amount,
      fine.issued_at,
      fine.status,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `multas-${filterPeriod || 'reporte'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <div className={styles.breadcrumb}>Admin / Multas</div>
          <h1 className={styles.title}>Gestión de Multas</h1>
          <p className={styles.subtitle}>Supervisión y control de infracciones registradas en el sistema.</p>
        </div>
        <button type="button" className={styles.btnPrimary} onClick={() => setIsFormOpen(true)}>
          + Registrar multa
        </button>
      </section>

      {(error || actionError) && <div className={styles.errorBanner}>{error || actionError}</div>}

      <section className={styles.metricsGrid}>
        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>Total emitido</span>
          <strong className={styles.metricValue}>{totals.total_count || 0}</strong>
          <span className={styles.metricFoot}>{formatCurrency(totals.total_amount)} en multas</span>
        </article>
        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>Pendiente de gestión</span>
          <strong className={styles.metricValue}>{formatCurrency(totals.active_amount)}</strong>
          <span className={styles.metricFoot}>{totals.active_count || 0} multas activas</span>
        </article>
        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>Infracción frecuente</span>
          <strong className={styles.metricValueSmall}>{topReason?.reason || 'Sin datos'}</strong>
          <span className={styles.metricFoot}>{topReason?.count || 0} registros</span>
        </article>
        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>Multas anuladas</span>
          <strong className={styles.metricValue}>{totals.annulled_count || 0}</strong>
          <span className={styles.metricFoot}>{formatCurrency(totals.annulled_amount)} anulados</span>
        </article>
      </section>

      <section className={styles.dashboardGrid}>
        <div className={styles.mainColumn}>
          <article className={styles.filtersPanel}>
            <strong>Filtros</strong>
            <PeriodSelector period={filterPeriod} onChange={setFilterPeriod} label="Período" />
            <select className={styles.select} value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}>
              {STATUS_FILTERS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>{option.label}</option>
              ))}
            </select>
            <select className={styles.select} value={filterReason} onChange={(event) => setFilterReason(event.target.value)}>
              <option value="">Motivo: Todos</option>
              {reasonOptions.map((reason) => (
                <option key={reason} value={reason}>{reason}</option>
              ))}
            </select>
            <input
              className={styles.searchInput}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar unidad, propietario o motivo"
            />
            <button type="button" className={styles.linkButton} onClick={clearFilters}>Limpiar filtros</button>
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <h2>Registro de multas</h2>
                <p>Mostrando {fines.length} de {pagination?.total || fines.length} registros.</p>
              </div>
              <button type="button" className={styles.btnSecondary} onClick={handleExport} disabled={!fines.length}>
                Exportar CSV
              </button>
            </div>

            {loading ? (
              <div className={styles.emptyState}>Cargando multas...</div>
            ) : fines.length ? (
              <>
                <div className={styles.tableWrap}>
                  <table className={styles.finesTable}>
                    <thead>
                      <tr>
                        <th>Unidad / Propietario</th>
                        <th>Infracción</th>
                        <th>Fecha</th>
                        <th>Monto</th>
                        <th>Estado</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fines.map((fine) => {
                        const status = STATUS_CONFIG[fine.status] || { label: fine.status, className: 'statusDefault' };
                        return (
                          <tr key={fine.id}>
                            <td>
                              <strong>Unidad {fine.apartment_code || 'N/D'}</strong>
                              <span>{fine.owner_name || 'Sin propietario'}</span>
                            </td>
                            <td>
                              <strong>{fine.reason || 'Sin motivo'}</strong>
                              <span>Período {fine.period}</span>
                            </td>
                            <td>{formatDate(fine.issued_at)}</td>
                            <td className={styles.amountCell}>{formatCurrency(fine.amount)}</td>
                            <td>
                              <span className={`${styles.statusBadge} ${styles[status.className]}`}>{status.label}</span>
                            </td>
                            <td>
                              <button
                                type="button"
                                className={styles.btnTable}
                                disabled={fine.status !== 'ACTIVA'}
                                onClick={() => setAnnulTarget(fine)}
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
                <div className={styles.pagination}>
                  <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>‹</button>
                  <span>Página {page} de {totalPages}</span>
                  <button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>›</button>
                </div>
              </>
            ) : (
              <div className={styles.emptyState}>No hay multas registradas.</div>
            )}
          </article>
        </div>

        <aside className={styles.sideColumn}>
          <article className={styles.panel}>
            <h2>Tendencia mensual</h2>
            {monthlyData.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={monthlyData} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(value) => `$${Number(value).toLocaleString()}`} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Bar dataKey="amount" name="Monto emitido" fill="#0b5bd3" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className={styles.emptyStateSmall}>Sin datos para graficar.</div>
            )}
          </article>

          <article className={styles.panel}>
            <h2>Motivos frecuentes</h2>
            {(stats.reasons || []).length ? (
              <div className={styles.reasonList}>
                {(stats.reasons || []).slice(0, 5).map((item) => (
                  <div className={styles.reasonItem} key={item.reason}>
                    <div>
                      <strong>{item.reason}</strong>
                      <span>{item.count} registros</span>
                    </div>
                    <b>{formatCurrency(item.amount)}</b>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyStateSmall}>No hay motivos registrados.</div>
            )}
          </article>
        </aside>
      </section>

      <FormModal
        isOpen={isFormOpen}
        title="Registrar multa"
        fields={getFineFields()}
        onSubmit={handleCreate}
        onClose={handleFormClose}
      />

      <ConfirmDialog
        isOpen={!!annulTarget}
        message={`¿Anular la multa de ${formatCurrency(annulTarget?.amount)}? El registro permanecerá en el sistema.`}
        confirmLabel="Anular multa"
        onConfirm={handleAnnul}
        onCancel={() => setAnnulTarget(null)}
      />
    </div>
  );
}

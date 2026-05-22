import { useState, useEffect } from 'react';
import { useApartmentFees } from '../../hooks/useApartmentFees';
import { useApartments } from '../../hooks/useApartments';
import { useApartmentFeeStats } from '../../hooks/useApartmentFeeStats';
import { usePeriodsSummary } from '../../hooks/usePeriodsSummary';
import StatsCard from '../../components/StatsCard/StatsCard';
import PeriodsHistoryTable from '../../components/PeriodsHistoryTable/PeriodsHistoryTable';
import styles from './AdminFeesPage.module.css';
import { useAuth } from '../../hooks/useAuth';
import { getFeesByPeriod, getApartmentFeeStats } from '../../services/apartmentFeeService';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

const MONTH_ABBR = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];

function getNextMonth(period) {
  const [year, month] = period.split('-').map(Number);
  if (month === 12) return `${year + 1}-01`;
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function getMonthAbbr(period) {
  const [, month] = period.split('-').map(Number);
  return MONTH_ABBR[month - 1] || '';
}

function formatMoney(value) {
  if (value == null) return '—';
  return `$${Number(value).toLocaleString('es-CL')}`;
}

export default function AdminFeesPage() {
  const currentPeriod = new Date().toISOString().slice(0, 7);
  const [period, setPeriod] = useState(currentPeriod);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkValues, setBulkValues] = useState({});
  const [bulkResult, setBulkResult] = useState(null);
  const [actionError, setActionError] = useState(null);

  const { token } = useAuth();

  // Modal "Ver detalle"
  const [detailPeriod, setDetailPeriod] = useState(null);
  const [detailFees, setDetailFees] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Modal "Ver estadísticas"
  const [chartPeriod, setChartPeriod] = useState(null);
  const [chartStats, setChartStats] = useState(null);
  const [chartLoading, setChartLoading] = useState(false);

  const { stats, fetchStats } = useApartmentFeeStats();
  const { periods, total, page, loading: periodsLoading, fetchPeriods } = usePeriodsSummary();
  const { fees, fetchFees, bulkUpload } = useApartmentFees();
  const { apartments, fetchApartments } = useApartments();

  useEffect(() => {
    fetchStats(currentPeriod);
    fetchPeriods(1, 10);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchApartments();
  }, [fetchApartments]);

  const feeMap = {};
  fees.forEach((f) => { feeMap[f.apartment_id] = f.amount; });

  const aptMap = {};
  apartments.forEach((a) => { aptMap[a.id] = a; });

  const handleEmitirProximoMes = () => {
    const nextMonth = getNextMonth(currentPeriod);
    setPeriod(nextMonth);
    setIsBulkOpen(true);
    setBulkValues({});
  };

  const handleBulkChange = (aptId, value) => {
    setBulkValues((prev) => ({ ...prev, [aptId]: value }));
  };

  const handleBulkSave = async () => {
    setActionError(null);
    setBulkResult(null);
    try {
      const feesList = Object.entries(bulkValues)
        .filter(([, amount]) => amount !== '' && amount !== undefined)
        .map(([apartment_id, amount]) => ({ apartment_id, amount: parseFloat(amount) }));
      if (!feesList.length) return;
      const result = await bulkUpload({ period, fees: feesList });
      setBulkResult(result);
      fetchFees(period);
      setIsBulkOpen(false);
      setBulkValues({});
    } catch (err) {
      setActionError(err.response?.data?.detail || 'Error al guardar cuotas');
    }
  };

  const handleViewDetail = async (row) => {
    setDetailPeriod(row);
    setDetailFees([]);
    setDetailLoading(true);
    try {
      const data = await getFeesByPeriod(token, row.period);
      setDetailFees(Array.isArray(data) ? data : []);
    } catch {
      setDetailFees([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleViewChart = async (row) => {
    setChartPeriod(row);
    setChartStats(null);
    setChartLoading(true);
    try {
      const data = await getApartmentFeeStats(row.period, token);
      setChartStats(data);
    } catch {
      setChartStats(null);
    } finally {
      setChartLoading(false);
    }
  };

  const handleExport = () => {
    if (!periods || periods.length === 0) return;

    const headers = ['Período', 'Estado', 'Total Emitido', 'Total Recaudado', 'Morosidad (%)'];
    const rows = periods.map((p) => [
      p.label || p.period,
      p.estado || '',
      p.total_emitido != null ? Number(p.total_emitido).toFixed(2) : '0',
      p.total_recaudado != null ? Number(p.total_recaudado).toFixed(2) : '0',
      p.morosidad_pct != null ? Number(p.morosidad_pct).toFixed(1) : '0',
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `historial-cuotas-${new Date().toISOString().slice(0, 7)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const variacion = stats?.tendencia_emitido;
  const emitidoBadge = variacion != null
    ? {
        text: `${variacion >= 0 ? '↑' : '↓'} ${Math.abs(variacion).toFixed(1)}% vs mes anterior`,
        color: variacion >= 0 ? 'green' : 'red',
      }
    : undefined;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Gestión de Cuotas</h1>
          <p className={styles.subtitle}>Control centralizado de emisión y recaudación por períodos.</p>
        </div>
        <button className={styles.btnPrimary} onClick={handleEmitirProximoMes}>
          + Emitir Cuota Próximo Mes
        </button>
      </div>

      {actionError && (
        <div className={styles.errorBanner}>{actionError}</div>
      )}
      {bulkResult && (
        <div className={styles.successBanner}>
          Guardado: {bulkResult.created} creados, {bulkResult.updated} actualizados
        </div>
      )}

      <div className={styles.statsGrid}>
        <StatsCard
          title={`TOTAL EMITIDO (${getMonthAbbr(currentPeriod)})`}
          value={formatMoney(stats?.total_emitido)}
          badge={emitidoBadge}
          icon="arrow"
        />
        <StatsCard
          title="TOTAL RECAUDADO"
          value={formatMoney(stats?.total_recaudado)}
          progressBar
          progressValue={stats?.porcentaje_recaudado ?? 0}
          progressLabel={`${stats?.porcentaje_recaudado ?? 0}% de la meta alcanzada`}
          icon="bank"
        />
        <StatsCard
          title="PENDIENTE DE COBRO"
          value={formatMoney(stats?.pendiente_cobro)}
          badge={{ text: `${stats?.unidades_deuda_vencida ?? 0} UNIDADES`, color: 'red' }}
          badgeSubtext="con deuda vencida"
          icon="clock"
        />
      </div>

      <PeriodsHistoryTable
        data={periods}
        loading={periodsLoading}
        total={total}
        page={page}
        pageSize={10}
        onPageChange={(p) => fetchPeriods(p, 10)}
        onFilterYear={(y) => fetchPeriods(1, 10, y)}
        onExport={handleExport}
        onViewDetail={handleViewDetail}
        onViewChart={handleViewChart}
      />

      {isBulkOpen && (
        <div className={styles.overlay} onClick={() => setIsBulkOpen(false)}>
          <div className={styles.bulkModal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Carga masiva — {period}</h2>
            <div className={styles.bulkGrid}>
              {apartments.map((apt) => (
                <div key={apt.id} className={styles.bulkRow}>
                  <label className={styles.bulkLabel}>Depto {apt.code}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={styles.bulkInput}
                    value={bulkValues[apt.id] ?? ''}
                    onChange={(e) => handleBulkChange(apt.id, e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              ))}
            </div>
            <div className={styles.bulkActions}>
              <button className={styles.btnCancel} onClick={() => setIsBulkOpen(false)}>Cancelar</button>
              <button className={styles.btnPrimary} onClick={handleBulkSave}>Guardar todo</button>
            </div>
          </div>
        </div>
      )}

      {detailPeriod && (
        <div className={styles.overlay} onClick={() => setDetailPeriod(null)}>
          <div className={styles.detailModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                Cuotas — {detailPeriod.label || detailPeriod.period}
              </h2>
              <button className={styles.modalClose} onClick={() => setDetailPeriod(null)}>✕</button>
            </div>
            {detailLoading ? (
              <p className={styles.loading}>Cargando...</p>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.th}>Departamento</th>
                      <th className={styles.th}>Piso</th>
                      <th className={styles.th}>Torre</th>
                      <th className={styles.th}>Cuota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailFees.length === 0 ? (
                      <tr>
                        <td colSpan={4} className={styles.td} style={{ textAlign: 'center', color: 'var(--color-gray-400)' }}>
                          Sin cuotas registradas en este período
                        </td>
                      </tr>
                    ) : (
                      detailFees.map((fee) => {
                        const apt = aptMap[fee.apartment_id] || {};
                        return (
                          <tr key={fee.id} className={styles.tr}>
                            <td className={styles.td}>{apt.code || '—'}</td>
                            <td className={styles.td}>{apt.floor ?? '—'}</td>
                            <td className={styles.td}>{apt.tower ?? '—'}</td>
                            <td className={styles.td}>{formatMoney(fee.amount)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {chartPeriod && (
        <div className={styles.overlay} onClick={() => setChartPeriod(null)}>
          <div className={styles.statsModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2 className={styles.modalTitle}>
                  Estadísticas — {chartPeriod.label || chartPeriod.period}
                </h2>
                <p className={styles.modalSubtitle}>
                  Período: {chartPeriod.period} · Estado:{' '}
                  <span className={`${styles.inlineBadge} ${styles[`inlineBadge_${(chartPeriod.estado || 'CERRADO').toUpperCase()}`]}`}>
                    {chartPeriod.estado || '—'}
                  </span>
                </p>
              </div>
              <button className={styles.modalClose} onClick={() => setChartPeriod(null)}>✕</button>
            </div>

            {chartLoading ? (
              <div className={styles.chartLoading}>
                <p className={styles.loading}>Cargando estadísticas...</p>
              </div>
            ) : chartStats ? (
              <>
                {/* Métricas resumidas — fila superior */}
                <div className={styles.statsSummaryGrid}>
                  <div className={styles.statsSummaryItem}>
                    <span className={styles.statsSummaryLabel}>Total Emitido</span>
                    <span className={styles.statsSummaryValue}>{formatMoney(chartStats.total_emitido)}</span>
                  </div>
                  <div className={styles.statsSummaryItem}>
                    <span className={styles.statsSummaryLabel}>Total Recaudado</span>
                    <span className={`${styles.statsSummaryValue} ${styles.colorSuccess}`}>{formatMoney(chartStats.total_recaudado)}</span>
                  </div>
                  <div className={styles.statsSummaryItem}>
                    <span className={styles.statsSummaryLabel}>Pendiente</span>
                    <span className={`${styles.statsSummaryValue} ${styles.colorDanger}`}>{formatMoney(chartStats.pendiente_cobro)}</span>
                  </div>
                  <div className={styles.statsSummaryItem}>
                    <span className={styles.statsSummaryLabel}>Unidades en mora</span>
                    <span className={`${styles.statsSummaryValue} ${styles.colorDanger}`}>{chartStats.unidades_deuda_vencida ?? 0}</span>
                  </div>
                </div>

                {/* Gráficos — dos columnas */}
                <div className={styles.chartsGrid}>
                  {/* Izquierda: Donut — Recaudado vs Pendiente */}
                  <div className={styles.chartBox}>
                    <h3 className={styles.chartTitle}>Recaudación del período</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Recaudado', value: Number(chartStats.total_recaudado) || 0 },
                            { name: 'Pendiente', value: Number(chartStats.pendiente_cobro) || 0 },
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          <Cell fill="#22c55e" />
                          <Cell fill="#ef4444" />
                        </Pie>
                        <Tooltip
                          formatter={(value) => [`$${Number(value).toLocaleString('es-CL')}`, '']}
                        />
                        <Legend
                          iconType="circle"
                          iconSize={10}
                          formatter={(value) => <span style={{ fontSize: 12, color: '#6b7280' }}>{value}</span>}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Porcentaje en el centro del donut — texto superpuesto */}
                    <p className={styles.donutCenter}>
                      {Number(chartStats.porcentaje_recaudado ?? 0).toFixed(1)}%
                      <span>de la meta</span>
                    </p>
                  </div>

                  {/* Derecha: BarChart — Emitido / Recaudado / Pendiente */}
                  <div className={styles.chartBox}>
                    <h3 className={styles.chartTitle}>Comparativa montos</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart
                        data={[
                          { name: 'Emitido', monto: Number(chartStats.total_emitido) || 0 },
                          { name: 'Recaudado', monto: Number(chartStats.total_recaudado) || 0 },
                          { name: 'Pendiente', monto: Number(chartStats.pendiente_cobro) || 0 },
                        ]}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11, fill: '#6b7280' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tickFormatter={(v) => v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`}
                          tick={{ fontSize: 10, fill: '#9ca3af' }}
                          axisLine={false}
                          tickLine={false}
                          width={48}
                        />
                        <Tooltip
                          formatter={(value) => [`$${Number(value).toLocaleString('es-CL')}`, 'Monto']}
                          cursor={{ fill: '#f9fafb' }}
                        />
                        <Bar dataKey="monto" radius={[6, 6, 0, 0]} maxBarSize={56}>
                          <Cell fill="#3b82f6" />
                          <Cell fill="#22c55e" />
                          <Cell fill="#ef4444" />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Barra de progreso de recaudación */}
                <div className={styles.progressSection}>
                  <div className={styles.progressSectionHeader}>
                    <span>Progreso de recaudación</span>
                    <span className={styles.progressPct}>{Number(chartStats.porcentaje_recaudado ?? 0).toFixed(1)}%</span>
                  </div>
                  <div className={styles.progressTrack}>
                    <div
                      className={styles.progressFillGreen}
                      style={{ width: `${Math.min(chartStats.porcentaje_recaudado ?? 0, 100)}%` }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <p className={styles.loading}>No hay datos disponibles para este período</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

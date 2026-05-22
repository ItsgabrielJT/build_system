import { useState, useEffect } from 'react';
import { useApartmentFees } from '../../hooks/useApartmentFees';
import { useApartments } from '../../hooks/useApartments';
import { useApartmentFeeStats } from '../../hooks/useApartmentFeeStats';
import { usePeriodsSummary } from '../../hooks/usePeriodsSummary';
import StatsCard from '../../components/StatsCard/StatsCard';
import PeriodsHistoryTable from '../../components/PeriodsHistoryTable/PeriodsHistoryTable';
import styles from './AdminFeesPage.module.css';

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

  const handleExport = () => {
    console.log('Exportar períodos');
  };

  const variacion = stats?.variacion_porcentaje;
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
          value={formatMoney(stats?.total_pendiente)}
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
        onViewDetail={(p) => console.log('ver', p)}
        onViewChart={(p) => console.log('chart', p)}
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
    </div>
  );
}

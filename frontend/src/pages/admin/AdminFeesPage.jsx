import { useState, useEffect } from 'react';
import { useApartmentFees } from '../../hooks/useApartmentFees';
import { useApartments } from '../../hooks/useApartments';
import { useApartmentFeeStats } from '../../hooks/useApartmentFeeStats';
import { usePeriodsSummary } from '../../hooks/usePeriodsSummary';
import StatsCard from '../../components/StatsCard/StatsCard';
import PeriodsHistoryTable from '../../components/PeriodsHistoryTable/PeriodsHistoryTable';
import styles from './AdminFeesPage.module.css';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../context/NotificationContext';
import { getFeesByPeriod, getApartmentFeeStats, updateFee } from '../../services/apartmentFeeService';
import { downloadFeesReport } from '../../services/reportService';
import DownloadIcon from '../../components/icons/DownloadIcon';
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
  return `$${Number(value).toLocaleString('es-CL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function periodInDateRange(period, startDate, endDate) {
  if (!period) return false;
  const startPeriod = startDate ? startDate.slice(0, 7) : null;
  const endPeriod = endDate ? endDate.slice(0, 7) : null;
  if (startPeriod && period < startPeriod) return false;
  if (endPeriod && period > endPeriod) return false;
  return true;
}

export default function AdminFeesPage() {
  const currentPeriod = new Date().toISOString().slice(0, 7);
  const initialRange = getCurrentMonthRange();
  const [period, setPeriod] = useState(currentPeriod);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkValues, setBulkValues] = useState({});
  const [distributionTotal, setDistributionTotal] = useState('');
  const [baseFeeAmount, setBaseFeeAmount] = useState('');
  const [bulkResult, setBulkResult] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [reportStartDate, setReportStartDate] = useState(initialRange.startDate);
  const [reportEndDate, setReportEndDate] = useState(initialRange.endDate);
  const [exportingReport, setExportingReport] = useState(null);

  const { token } = useAuth();
  const { success, error: toastError } = useNotification();

  // Modal "Ver detalle"
  const [detailPeriod, setDetailPeriod] = useState(null);
  const [detailFees, setDetailFees] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editingFeeId, setEditingFeeId] = useState(null);
  const [editingFeeAmount, setEditingFeeAmount] = useState('');
  const [savingFeeId, setSavingFeeId] = useState(null);

  // Selección para eliminación masiva e ingreso de cuota individual
  const [selectedFeeIds, setSelectedFeeIds] = useState([]);
  const [newFeeApartmentId, setNewFeeApartmentId] = useState('');
  const [newFeeAmount, setNewFeeAmount] = useState('');
  const [isCreatingFee, setIsCreatingFee] = useState(false);

  // Modal de confirmación personalizado para eliminación
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
  });

  const showConfirmDelete = (title, message, onConfirm) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm,
    });
  };

  const closeConfirmModal = () => {
    setConfirmModal({
      isOpen: false,
      title: '',
      message: '',
      onConfirm: null,
    });
  };

  // Modal "Ver estadísticas"
  const [chartPeriod, setChartPeriod] = useState(null);
  const [chartStats, setChartStats] = useState(null);
  const [chartLoading, setChartLoading] = useState(false);

  const { stats, fetchStats } = useApartmentFeeStats();
  const { periods, loading: periodsLoading, fetchPeriods } = usePeriodsSummary();
  const { fees, fetchFees, createFee, bulkUpload, deleteFee, bulkDelete } = useApartmentFees();
  const { apartments, fetchApartments } = useApartments();

  useEffect(() => {
    fetchStats(currentPeriod);
    fetchPeriods(1, 100);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchApartments();
  }, [fetchApartments]);

  const feeMap = {};
  fees.forEach((f) => { feeMap[f.apartment_id] = f.amount; });

  const aptMap = {};
  apartments.forEach((a) => { aptMap[a.id] = a; });

  // Función comparadora para ordenar torres y departamentos según especificación
  const compareApartments = (aptA, aptB) => {
    const tA = aptA.tower ? aptA.tower.toString().trim() : '';
    const tB = aptB.tower ? aptB.tower.toString().trim() : '';

    // 1. Las torres vacías van al final
    if (!tA && tB) return 1;
    if (tA && !tB) return -1;
    
    if (tA || tB) {
      // Torres con nombres largos como "Suit", "Suite" o de 4 o más caracteres van primero (quemado)
      const isSuitA = tA.toLowerCase() === 'suit' || tA.toLowerCase() === 'suite' || tA.length >= 4;
      const isSuitB = tB.toLowerCase() === 'suit' || tB.toLowerCase() === 'suite' || tB.length >= 4;

      if (isSuitA && !isSuitB) return -1;
      if (!isSuitA && isSuitB) return 1;

      // Orden descendente por torre en abecedario y numeración (e.g. C1, B, A)
      const towerCompare = tB.localeCompare(tA, undefined, { numeric: true, sensitivity: 'base' });
      if (towerCompare !== 0) return towerCompare;
    }

    // 2. Orden secundario por Piso (floor) en orden descendente (piso más alto primero)
    const fA = aptA.floor != null ? Number(aptA.floor) : -Infinity;
    const fB = aptB.floor != null ? Number(aptB.floor) : -Infinity;
    if (fA !== fB) {
      return fB - fA;
    }

    // 3. Orden terciario por código de departamento (code) en orden descendente
    const codeA = aptA.code ? aptA.code.toString().trim() : '';
    const codeB = aptB.code ? aptB.code.toString().trim() : '';
    return codeB.localeCompare(codeA, undefined, { numeric: true });
  };

  const sortApartments = (aptsList) => {
    return [...aptsList].sort(compareApartments);
  };

  const sortDetailFees = (feesList) => {
    return [...feesList].sort((a, b) => {
      const aptA = aptMap[a.apartment_id] || {};
      const aptB = aptMap[b.apartment_id] || {};
      return compareApartments(aptA, aptB);
    });
  };


  const totalOwnerQuotaPercent = apartments.reduce(
    (sum, apt) => sum + Number(apt.owner_allocated_quota_percent || 0),
    0
  );

  const calculatedBulkTotal = apartments.reduce((sum, apt) => (
    sum + Number(bulkValues[apt.id] || 0)
  ), 0);

  const filteredPeriods = periods.filter((row) => periodInDateRange(row.period, reportStartDate, reportEndDate));

  const handleEmitirMesCurso = () => {
    setPeriod(currentPeriod);
    setIsBulkOpen(true);
    setBulkValues({});
    setDistributionTotal('');
    setBaseFeeAmount('');
  };

  const handleBulkChange = (aptId, value) => {
    setBulkValues((prev) => ({ ...prev, [aptId]: value }));
  };

  const calculateFeeAmount = (apt) => {
    const quotaPercent = Number(apt.owner_allocated_quota_percent || 0);
    const distributedAmount = Number(distributionTotal || 0) * (quotaPercent / 100);
    return roundMoney(Number(baseFeeAmount || 0) + distributedAmount);
  };

  const handleApplyQuotaCalculation = () => {
    const nextValues = {};
    apartments.forEach((apt) => {
      nextValues[apt.id] = calculateFeeAmount(apt).toFixed(2);
    });
    setBulkValues(nextValues);
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
      success('Cuotas guardadas con éxito');
      setBulkResult(result);
      await Promise.all([
        fetchFees(period),
        fetchStats(period),
        fetchPeriods(1, 100),
      ]);
      setIsBulkOpen(false);
      setBulkValues({});
    } catch (err) {
      const msg = err.response?.data?.detail || 'Error al guardar cuotas';
      setActionError(msg);
      toastError(msg);
    }
  };

  const handleViewDetail = async (row) => {
    setDetailPeriod(row);
    setDetailFees([]);
    setDetailLoading(true);
    setEditingFeeId(null);
    setEditingFeeAmount('');
    setSelectedFeeIds([]);
    setNewFeeApartmentId('');
    setNewFeeAmount('');
    try {
      const data = await getFeesByPeriod(token, row.period);
      setDetailFees(Array.isArray(data) ? data : []);
    } catch {
      setDetailFees([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleStartEditFee = (fee) => {
    setEditingFeeId(fee.id);
    setEditingFeeAmount(String(fee.amount ?? ''));
  };

  const handleCancelEditFee = () => {
    setEditingFeeId(null);
    setEditingFeeAmount('');
  };

  const getFeeStatus = (fee) => {
    const paid = Number(fee.paid_amount || 0);
    const pending = Number(fee.pending_amount || 0);
    const credit = Number(fee.credit_amount || 0);
    if (credit > 0) return { label: `Saldo a favor ${formatMoney(credit)}`, className: styles.inlineBadge_CREDIT };
    if (pending > 0 && paid > 0) return { label: `Debe ${formatMoney(pending)}`, className: styles.inlineBadge_PENDIENTE };
    if (pending > 0) return { label: 'Pendiente', className: styles.inlineBadge_PENDIENTE };
    return { label: 'Pagado', className: styles.inlineBadge_PAGADO };
  };

  const formatPriorBalance = (fee) => {
    const debt = Number(fee.prior_debt_amount || 0);
    const credit = Number(fee.prior_credit_amount || 0);
    if (credit > 0) return `A favor ${formatMoney(credit)}`;
    if (debt > 0) return `Debía ${formatMoney(debt)}`;
    return formatMoney(0);
  };

  const handleSaveFee = async (fee) => {
    const nextAmount = Number(editingFeeAmount);
    if (!Number.isFinite(nextAmount) || nextAmount < 0) {
      toastError('Ingrese un valor válido para la cuota');
      return;
    }
    setSavingFeeId(fee.id);
    try {
      await updateFee(fee.id, { amount: nextAmount }, token);
      const data = await getFeesByPeriod(token, fee.period);
      setDetailFees(Array.isArray(data) ? data : []);
      await Promise.all([
        fetchFees(fee.period),
        fetchStats(fee.period),
        fetchPeriods(1, 100),
      ]);
      success('Cuota actualizada con éxito');
      handleCancelEditFee();
    } catch (err) {
      toastError(err.response?.data?.detail || 'Error al actualizar la cuota');
    } finally {
      setSavingFeeId(null);
    }
  };

  const handleDeleteFee = (fee) => {
    const title = '¿Eliminar esta cuota?';
    const message = `Se eliminará la cuota de este departamento en el período ${fee.period} y se borrarán de forma permanente todos los pagos asociados a ella.`;
    showConfirmDelete(title, message, async () => {
      try {
        await deleteFee(fee.id);
        success('Cuota y sus pagos asociados eliminados con éxito');
        setSelectedFeeIds((prev) => prev.filter((id) => id !== fee.id));
        const data = await getFeesByPeriod(token, fee.period);
        setDetailFees(Array.isArray(data) ? data : []);
        await Promise.all([
          fetchFees(fee.period),
          fetchStats(fee.period),
          fetchPeriods(1, 100),
        ]);
      } catch (err) {
        toastError(err.response?.data?.detail || 'Error al eliminar la cuota');
      } finally {
        closeConfirmModal();
      }
    });
  };

  const handleBulkDeleteFees = () => {
    if (selectedFeeIds.length === 0) return;
    const title = `¿Eliminar ${selectedFeeIds.length} cuotas?`;
    const message = `Se eliminarán las cuotas seleccionadas del período ${detailPeriod.period} y se borrarán permanentemente todos los pagos relacionados a las mismas.`;
    showConfirmDelete(title, message, async () => {
      try {
        await bulkDelete(selectedFeeIds);
        success('Cuotas y pagos asociados eliminados con éxito');
        setSelectedFeeIds([]);
        const data = await getFeesByPeriod(token, detailPeriod.period);
        setDetailFees(Array.isArray(data) ? data : []);
        await Promise.all([
          fetchFees(detailPeriod.period),
          fetchStats(detailPeriod.period),
          fetchPeriods(1, 100),
        ]);
      } catch (err) {
        toastError(err.response?.data?.detail || 'Error al eliminar las cuotas');
      } finally {
        closeConfirmModal();
      }
    });
  };

  const handleCreateIndividualFee = async () => {
    const amountVal = parseFloat(newFeeAmount);
    if (!newFeeApartmentId) {
      toastError('Por favor seleccione un departamento');
      return;
    }
    if (isNaN(amountVal) || amountVal < 0) {
      toastError('Ingrese un monto válido para la cuota');
      return;
    }

    setIsCreatingFee(true);
    try {
      await createFee({
        apartment_id: newFeeApartmentId,
        period: detailPeriod.period,
        amount: amountVal,
      });
      success('Cuota creada con éxito');
      setNewFeeApartmentId('');
      setNewFeeAmount('');
      const data = await getFeesByPeriod(token, detailPeriod.period);
      setDetailFees(Array.isArray(data) ? data : []);
      await Promise.all([
        fetchFees(detailPeriod.period),
        fetchStats(detailPeriod.period),
        fetchPeriods(1, 100),
      ]);
    } catch (err) {
      toastError(err.response?.data?.detail || 'Error al crear la cuota');
    } finally {
      setIsCreatingFee(false);
    }
  };

  const handleToggleSelectAll = () => {
    if (selectedFeeIds.length === detailFees.length) {
      setSelectedFeeIds([]);
    } else {
      setSelectedFeeIds(detailFees.map((f) => f.id));
    }
  };

  const handleToggleSelectFee = (feeId) => {
    setSelectedFeeIds((prev) =>
      prev.includes(feeId) ? prev.filter((id) => id !== feeId) : [...prev, feeId]
    );
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

  const handleDownloadReport = async (format) => {
    setExportingReport(format);
    setActionError(null);
    try {
      const blob = await downloadFeesReport(token, {
        format,
        start_date: reportStartDate,
        end_date: reportEndDate,
      });
      const ext = format === 'excel' ? 'xlsx' : 'pdf';
      triggerDownload(blob, `reporte-cuotas-${reportStartDate}-${reportEndDate}.${ext}`);
      success(`Reporte de cuotas descargado en ${format === 'excel' ? 'Excel' : 'PDF'}`);
    } catch (err) {
      const msg = err.response?.data?.detail || 'Error al descargar el reporte de cuotas';
      setActionError(msg);
      toastError(msg);
    } finally {
      setExportingReport(null);
    }
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
        <div className={styles.reportActions}>
          <label className={styles.dateField}>
            <span>Inicio</span>
            <input type="date" value={reportStartDate} onChange={(event) => setReportStartDate(event.target.value)} />
          </label>
          <label className={styles.dateField}>
            <span>Fin</span>
            <input type="date" value={reportEndDate} onChange={(event) => setReportEndDate(event.target.value)} />
          </label>
          <button className={styles.btnReport} onClick={() => handleDownloadReport('pdf')} disabled={exportingReport === 'pdf'}>
            <DownloadIcon />
            {exportingReport === 'pdf' ? 'Generando...' : 'PDF'}
          </button>
          <button className={styles.btnReportSecondary} onClick={() => handleDownloadReport('excel')} disabled={exportingReport === 'excel'}>
            <DownloadIcon />
            {exportingReport === 'excel' ? 'Generando...' : 'Excel'}
          </button>
          <button className={styles.btnPrimary} onClick={handleEmitirMesCurso}>
            + Emitir Cuota Mes en Curso
          </button>
        </div>
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
        data={filteredPeriods}
        loading={periodsLoading}
        total={filteredPeriods.length}
        page={1}
        pageSize={Math.max(filteredPeriods.length, 1)}
        onExport={() => handleDownloadReport('excel')}
        onViewDetail={handleViewDetail}
        onViewChart={handleViewChart}
      />

      {isBulkOpen && (
        <div className={styles.overlay} onClick={() => setIsBulkOpen(false)}>
          <div className={styles.bulkModal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Carga masiva — {period}</h2>
            <label className={styles.periodField}>
              <span>Mes de emisión</span>
              <input
                type="month"
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
              />
            </label>
            <div className={styles.calculationPanel}>
              <label className={styles.periodField}>
                <span>Total a distribuir por alícuota</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={distributionTotal}
                  onChange={(event) => setDistributionTotal(event.target.value)}
                  placeholder="Ej: 834.93 o 5000.00"
                />
              </label>
              <label className={styles.periodField}>
                <span>Valor base adicional por unidad</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={baseFeeAmount}
                  onChange={(event) => setBaseFeeAmount(event.target.value)}
                  placeholder="Ej: 0.00"
                />
              </label>
              <div className={styles.calculationSummary}>
                <span>Alícuota detectada: {totalOwnerQuotaPercent.toFixed(2)}%</span>
                <strong>Total preparado: {formatMoney(calculatedBulkTotal)}</strong>
              </div>
              <button type="button" className={styles.btnReportSecondary} onClick={handleApplyQuotaCalculation}>
                Calcular valores
              </button>
            </div>
            <div className={styles.bulkGrid}>
              {sortApartments(apartments).map((apt) => {
                const quotaPercent = Number(apt.owner_allocated_quota_percent || 0);
                const previewAmount = calculateFeeAmount(apt);
                return (
                  <div key={apt.id} className={styles.bulkRow}>
                    <label className={styles.bulkLabel}>
                      <span>Depto {apt.code}</span>
                      <small>{apt.owner_name || 'Sin propietario'} · {quotaPercent.toFixed(2)}% · Calc. {formatMoney(previewAmount)}</small>
                    </label>
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
                );
              })}
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
              <>
                {selectedFeeIds.length > 0 && (
                  <div className={styles.bulkHeaderActions}>
                    <span className={styles.selectedCountText}>
                      {selectedFeeIds.length} seleccionado(s)
                    </span>
                    <button
                      type="button"
                      className={styles.btnDanger}
                      onClick={handleBulkDeleteFees}
                    >
                      Eliminar seleccionados
                    </button>
                  </div>
                )}
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th className={`${styles.th} ${styles.checkboxTh}`}>
                          <input
                            type="checkbox"
                            className={styles.checkboxInput}
                            checked={detailFees.length > 0 && selectedFeeIds.length === detailFees.length}
                            onChange={handleToggleSelectAll}
                          />
                        </th>
                        <th className={styles.th}>Departamento</th>
                        <th className={styles.th}>Piso</th>
                        <th className={styles.th}>Torre</th>
                        <th className={styles.th}>Saldo anterior</th>
                        <th className={styles.th}>Cuota</th>
                        <th className={styles.th}>Pagado mes</th>
                        <th className={styles.th}>Estado</th>
                        <th className={styles.th}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailFees.length === 0 ? (
                        <tr>
                          <td colSpan={9} className={styles.td} style={{ textAlign: 'center', color: 'var(--color-gray-400)' }}>
                            Sin cuotas registradas en este período
                          </td>
                        </tr>
                      ) : (
                        sortDetailFees(detailFees).map((fee) => {
                          const apt = aptMap[fee.apartment_id] || {};
                          const status = getFeeStatus(fee);
                          const isEditing = editingFeeId === fee.id;
                          return (
                            <tr key={fee.id} className={styles.tr}>
                              <td className={styles.checkboxTd}>
                                <input
                                  type="checkbox"
                                  className={styles.checkboxInput}
                                  checked={selectedFeeIds.includes(fee.id)}
                                  onChange={() => handleToggleSelectFee(fee.id)}
                                />
                              </td>
                              <td className={styles.td}>{apt.code || '—'}</td>
                              <td className={styles.td}>{apt.floor ?? '—'}</td>
                              <td className={styles.td}>{apt.tower ?? '—'}</td>
                              <td className={styles.td}>{formatPriorBalance(fee)}</td>
                              <td className={styles.td}>
                                {isEditing ? (
                                  <input
                                    className={styles.inlineInput}
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={editingFeeAmount}
                                    onChange={(event) => setEditingFeeAmount(event.target.value)}
                                  />
                                ) : (
                                  formatMoney(fee.amount)
                                )}
                              </td>
                              <td className={styles.td}>{formatMoney(fee.paid_amount || 0)}</td>
                              <td className={styles.td}>
                                <span className={`${styles.inlineBadge} ${status.className}`}>
                                  {status.label}
                                </span>
                              </td>
                              <td className={styles.td}>
                                {isEditing ? (
                                  <div className={styles.inlineActions}>
                                    <button
                                      type="button"
                                      className={styles.btnInlinePrimary}
                                      onClick={() => handleSaveFee(fee)}
                                      disabled={savingFeeId === fee.id}
                                    >
                                      {savingFeeId === fee.id ? 'Guardando...' : 'Guardar'}
                                    </button>
                                    <button type="button" className={styles.btnInline} onClick={handleCancelEditFee}>
                                      Cancelar
                                    </button>
                                  </div>
                                ) : (
                                  <div className={styles.inlineActions}>
                                    <button type="button" className={styles.btnInline} onClick={() => handleStartEditFee(fee)}>
                                      Editar
                                    </button>
                                    <button type="button" className={styles.btnInlineDanger} onClick={() => handleDeleteFee(fee)}>
                                      Eliminar
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Formulario de asignación individual */}
                {(() => {
                  const apartmentsWithoutFee = sortApartments(
                    apartments.filter((apt) => !detailFees.some((fee) => fee.apartment_id === apt.id))
                  );
                  if (apartmentsWithoutFee.length === 0) return null;

                  return (
                    <div className={styles.addFeePanel}>
                      <h3 className={styles.addFeeTitle}>Asignar cuota a departamento sin cuota</h3>
                      <div className={styles.addFeeForm}>
                        <select
                          value={newFeeApartmentId}
                          onChange={(e) => setNewFeeApartmentId(e.target.value)}
                          className={styles.addFeeSelect}
                        >
                          <option value="">Seleccione departamento...</option>
                          {apartmentsWithoutFee.map((apt) => (
                            <option key={apt.id} value={apt.id}>
                              Depto {apt.code} ({apt.owner_name || 'Sin propietario'})
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={newFeeAmount}
                          onChange={(e) => setNewFeeAmount(e.target.value)}
                          placeholder="Monto de la cuota"
                          className={styles.addFeeInput}
                        />
                        <button
                          type="button"
                          onClick={handleCreateIndividualFee}
                          className={styles.btnInlinePrimary}
                          disabled={!newFeeApartmentId || !newFeeAmount || isCreatingFee}
                          style={{ height: '40px' }}
                        >
                          {isCreatingFee ? 'Creando...' : 'Crear cuota'}
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </>
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

      {confirmModal.isOpen && (
        <div className={styles.confirmOverlay} onClick={closeConfirmModal}>
          <div className={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmIconContainer}>
              <svg className={styles.confirmIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h3 className={styles.confirmTitle}>{confirmModal.title}</h3>
            <p className={styles.confirmMessage}>{confirmModal.message}</p>
            <div className={styles.confirmActions}>
              <button type="button" className={styles.btnConfirmCancel} onClick={closeConfirmModal}>
                Cancelar
              </button>
              <button
                type="button"
                className={styles.btnConfirmDelete}
                onClick={confirmModal.onConfirm}
              >
                Eliminar de todos modos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useApartments } from '../../hooks/useApartments';
import { useOtherCharges } from '../../hooks/useOtherCharges';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../context/NotificationContext';
import StatsCard from '../../components/StatsCard/StatsCard';
import PeriodsHistoryTable from '../../components/PeriodsHistoryTable/PeriodsHistoryTable';
import {
  getOtherChargesByPeriod,
  getOtherChargeStats,
  getOtherChargePeriodsSummary,
  updateOtherCharge,
} from '../../services/otherChargeService';
import styles from './AdminFeesPage.module.css';

const MONTH_ABBR = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];

function getMonthAbbr(period) {
  const [, month] = period.split('-').map(Number);
  return MONTH_ABBR[month - 1] || '';
}

function formatMoney(value) {
  if (value == null) return '-';
  return `$${Number(value).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AdminOtherChargesPage() {
  const currentPeriod = new Date().toISOString().slice(0, 7);
  const [period, setPeriod] = useState(currentPeriod);
  const [concept, setConcept] = useState('');
  const [sameAmount, setSameAmount] = useState('');
  const [bulkValues, setBulkValues] = useState({});
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [periods, setPeriods] = useState([]);
  const [stats, setStats] = useState(null);
  const [periodsLoading, setPeriodsLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [detailPeriod, setDetailPeriod] = useState(null);
  const [detailCharges, setDetailCharges] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedChargeIds, setSelectedChargeIds] = useState([]);
  const [editingChargeId, setEditingChargeId] = useState(null);
  const [editingAmount, setEditingAmount] = useState('');
  const [editingConcept, setEditingConcept] = useState('');
  const [savingChargeId, setSavingChargeId] = useState(null);
  const [newChargeApartmentId, setNewChargeApartmentId] = useState('');
  const [newChargeAmount, setNewChargeAmount] = useState('');
  const [isCreatingCharge, setIsCreatingCharge] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  const { token } = useAuth();
  const { success, error: toastError } = useNotification();
  const { apartments, fetchApartments } = useApartments();
  const { bulkUpload, createCharge, deleteCharge, bulkDelete } = useOtherCharges();

  const aptMap = {};
  apartments.forEach((a) => { aptMap[a.id] = a; });

  const compareApartments = (aptA, aptB) => {
    const tA = aptA.tower ? aptA.tower.toString().trim() : '';
    const tB = aptB.tower ? aptB.tower.toString().trim() : '';
    if (!tA && tB) return 1;
    if (tA && !tB) return -1;
    if (tA || tB) {
      const towerCompare = tB.localeCompare(tA, undefined, { numeric: true, sensitivity: 'base' });
      if (towerCompare !== 0) return towerCompare;
    }
    const fA = aptA.floor != null ? Number(aptA.floor) : -Infinity;
    const fB = aptB.floor != null ? Number(aptB.floor) : -Infinity;
    if (fA !== fB) return fB - fA;
    return String(aptB.code || '').localeCompare(String(aptA.code || ''), undefined, { numeric: true });
  };
  const sortApartments = (items) => [...items].sort(compareApartments);
  const sortCharges = (items) => [...items].sort((a, b) => compareApartments(aptMap[a.apartment_id] || a, aptMap[b.apartment_id] || b));

  const loadDashboard = async () => {
    setPeriodsLoading(true);
    try {
      const [statsData, periodsData] = await Promise.all([
        getOtherChargeStats(currentPeriod, token),
        getOtherChargePeriodsSummary(1, 100, null, token),
      ]);
      setStats(statsData);
      setPeriods(periodsData.data || []);
    } finally {
      setPeriodsLoading(false);
    }
  };

  useEffect(() => {
    fetchApartments();
    loadDashboard();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshPeriod = async (targetPeriod = period) => {
    const [statsData, periodsData] = await Promise.all([
      getOtherChargeStats(targetPeriod, token),
      getOtherChargePeriodsSummary(1, 100, null, token),
    ]);
    setStats(statsData);
    setPeriods(periodsData.data || []);
  };

  const openBulk = () => {
    setPeriod(currentPeriod);
    setConcept('');
    setSameAmount('');
    setBulkValues({});
    setBulkResult(null);
    setActionError(null);
    setIsBulkOpen(true);
  };

  const handleBulkSave = async () => {
    setActionError(null);
    if (!concept.trim()) {
      toastError('Ingrese el concepto del cobro');
      return;
    }
    const charges = Object.entries(bulkValues)
      .filter(([, amount]) => amount !== '' && amount !== undefined)
      .map(([apartment_id, amount]) => ({ apartment_id, amount: parseFloat(amount) }));
    if (!charges.length) return;
    try {
      const result = await bulkUpload({ period, concept, charges });
      setBulkResult(result);
      success('Cobros guardados con éxito');
      setIsBulkOpen(false);
      setBulkValues({});
      await refreshPeriod(period);
    } catch (err) {
      const msg = err.response?.data?.detail || 'Error al guardar cobros';
      setActionError(msg);
      toastError(msg);
    }
  };

  const handleViewDetail = async (row) => {
    setDetailPeriod(row);
    setDetailCharges([]);
    setSelectedChargeIds([]);
    setDetailLoading(true);
    try {
      const data = await getOtherChargesByPeriod(token, row.period);
      setDetailCharges(Array.isArray(data) ? data : []);
    } finally {
      setDetailLoading(false);
    }
  };

  const startEdit = (charge) => {
    setEditingChargeId(charge.id);
    setEditingAmount(String(charge.amount ?? ''));
    setEditingConcept(charge.concept || '');
  };

  const cancelEdit = () => {
    setEditingChargeId(null);
    setEditingAmount('');
    setEditingConcept('');
  };

  const saveCharge = async (charge) => {
    const amount = Number(editingAmount);
    if (!editingConcept.trim()) {
      toastError('Ingrese el concepto del cobro');
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      toastError('Ingrese un monto válido');
      return;
    }
    setSavingChargeId(charge.id);
    try {
      await updateOtherCharge(charge.id, { concept: editingConcept, amount }, token);
      const data = await getOtherChargesByPeriod(token, charge.period);
      setDetailCharges(Array.isArray(data) ? data : []);
      await refreshPeriod(charge.period);
      success('Cobro actualizado con éxito');
      cancelEdit();
    } catch (err) {
      toastError(err.response?.data?.detail || 'Error al actualizar el cobro');
    } finally {
      setSavingChargeId(null);
    }
  };

  const showConfirmDelete = (title, message, onConfirm) => {
    setConfirmModal({ isOpen: true, title, message, onConfirm });
  };
  const closeConfirm = () => setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null });

  const handleDeleteCharge = (charge) => {
    showConfirmDelete('¿Eliminar este cobro?', `Se eliminará "${charge.concept}" del período ${charge.period} y sus pagos asociados.`, async () => {
      try {
        await deleteCharge(charge.id);
        const data = await getOtherChargesByPeriod(token, charge.period);
        setDetailCharges(Array.isArray(data) ? data : []);
        await refreshPeriod(charge.period);
        success('Cobro eliminado con éxito');
      } catch (err) {
        toastError(err.response?.data?.detail || 'Error al eliminar el cobro');
      } finally {
        closeConfirm();
      }
    });
  };

  const handleBulkDelete = () => {
    if (!selectedChargeIds.length) return;
    showConfirmDelete(`¿Eliminar ${selectedChargeIds.length} cobros?`, 'Se eliminarán los cobros seleccionados y sus pagos asociados.', async () => {
      try {
        await bulkDelete(selectedChargeIds);
        setSelectedChargeIds([]);
        const data = await getOtherChargesByPeriod(token, detailPeriod.period);
        setDetailCharges(Array.isArray(data) ? data : []);
        await refreshPeriod(detailPeriod.period);
        success('Cobros eliminados con éxito');
      } catch (err) {
        toastError(err.response?.data?.detail || 'Error al eliminar cobros');
      } finally {
        closeConfirm();
      }
    });
  };

  const handleCreateIndividual = async () => {
    const amount = Number(newChargeAmount);
    const defaultConcept = detailCharges[0]?.concept || concept;
    if (!newChargeApartmentId) {
      toastError('Seleccione un departamento');
      return;
    }
    if (!defaultConcept.trim()) {
      toastError('Ingrese el concepto en la carga masiva o edite uno existente');
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      toastError('Ingrese un monto válido');
      return;
    }
    setIsCreatingCharge(true);
    try {
      await createCharge({ apartment_id: newChargeApartmentId, period: detailPeriod.period, concept: defaultConcept, amount });
      const data = await getOtherChargesByPeriod(token, detailPeriod.period);
      setDetailCharges(Array.isArray(data) ? data : []);
      setNewChargeApartmentId('');
      setNewChargeAmount('');
      await refreshPeriod(detailPeriod.period);
      success('Cobro creado con éxito');
    } catch (err) {
      toastError(err.response?.data?.detail || 'Error al crear el cobro');
    } finally {
      setIsCreatingCharge(false);
    }
  };

  const getStatus = (charge) => {
    const paid = Number(charge.paid_amount || 0);
    const pending = Number(charge.pending_amount || 0);
    if (pending > 0 && paid > 0) return { label: `Debe ${formatMoney(pending)}`, className: styles.inlineBadge_PENDIENTE };
    if (pending > 0) return { label: 'Pendiente', className: styles.inlineBadge_PENDIENTE };
    return { label: 'Pagado', className: styles.inlineBadge_PAGADO };
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Otros Cobros</h1>
          <p className={styles.subtitle}>Cobros adicionales separados de la alícuota, por período y concepto.</p>
        </div>
        <div className={styles.reportActions}>
          <button className={styles.btnPrimary} onClick={openBulk}>+ Generar cobro</button>
        </div>
      </div>

      {actionError && <div className={styles.errorBanner}>{actionError}</div>}
      {bulkResult && <div className={styles.successBanner}>Guardado: {bulkResult.created} creados, {bulkResult.updated} actualizados</div>}

      <div className={styles.statsGrid}>
        <StatsCard title={`TOTAL EMITIDO (${getMonthAbbr(currentPeriod)})`} value={formatMoney(stats?.total_emitido)} icon="arrow" />
        <StatsCard title="TOTAL RECAUDADO" value={formatMoney(stats?.total_recaudado)} progressBar progressValue={stats?.porcentaje_recaudado ?? 0} progressLabel={`${stats?.porcentaje_recaudado ?? 0}% de la meta alcanzada`} icon="bank" />
        <StatsCard title="PENDIENTE DE COBRO" value={formatMoney(stats?.pendiente_cobro)} badge={{ text: `${stats?.unidades_deuda_vencida ?? 0} UNIDADES`, color: 'red' }} badgeSubtext="con saldo pendiente" icon="clock" />
      </div>

      <PeriodsHistoryTable
        data={periods}
        loading={periodsLoading}
        total={periods.length}
        page={1}
        pageSize={Math.max(periods.length, 1)}
        onExport={() => {}}
        onViewDetail={handleViewDetail}
      />

      {isBulkOpen && (
        <div className={styles.overlay} onClick={() => setIsBulkOpen(false)}>
          <div className={styles.bulkModal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Generar cobro — {period}</h2>
            <div className={styles.calculationPanel}>
              <label className={styles.periodField}>
                <span>Mes desde el que se cobra</span>
                <input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} />
              </label>
              <label className={styles.periodField}>
                <span>Concepto</span>
                <input type="text" value={concept} onChange={(event) => setConcept(event.target.value)} placeholder="Ej: Fondo extraordinario" />
              </label>
              <label className={styles.periodField}>
                <span>Valor para todos</span>
                <input type="number" min="0" step="0.01" value={sameAmount} onChange={(event) => setSameAmount(event.target.value)} placeholder="0.00" />
              </label>
              <button
                type="button"
                className={styles.btnReportSecondary}
                onClick={() => {
                  const nextValues = {};
                  apartments.forEach((apt) => { nextValues[apt.id] = sameAmount; });
                  setBulkValues(nextValues);
                }}
                disabled={sameAmount === ''}
              >
                Aplicar a todos
              </button>
            </div>
            <div className={styles.bulkGrid}>
              {sortApartments(apartments).map((apt) => (
                <div key={apt.id} className={styles.bulkRow}>
                  <label className={styles.bulkLabel}>
                    <span>Depto {apt.code}</span>
                    <small>{apt.owner_name || 'Sin propietario'} · Torre {apt.tower || '-'} · Piso {apt.floor ?? '-'}</small>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={styles.bulkInput}
                    value={bulkValues[apt.id] ?? ''}
                    onChange={(event) => setBulkValues((prev) => ({ ...prev, [apt.id]: event.target.value }))}
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
              <h2 className={styles.modalTitle}>Otros Cobros — {detailPeriod.label || detailPeriod.period}</h2>
              <button className={styles.modalClose} onClick={() => setDetailPeriod(null)}>x</button>
            </div>
            {detailLoading ? <p className={styles.loading}>Cargando...</p> : (
              <>
                {selectedChargeIds.length > 0 && (
                  <div className={styles.bulkHeaderActions}>
                    <span className={styles.selectedCountText}>{selectedChargeIds.length} seleccionado(s)</span>
                    <button type="button" className={styles.btnDanger} onClick={handleBulkDelete}>Eliminar seleccionados</button>
                  </div>
                )}
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th className={`${styles.th} ${styles.checkboxTh}`}><input type="checkbox" className={styles.checkboxInput} checked={detailCharges.length > 0 && selectedChargeIds.length === detailCharges.length} onChange={() => setSelectedChargeIds(selectedChargeIds.length === detailCharges.length ? [] : detailCharges.map((c) => c.id))} /></th>
                        <th className={styles.th}>Departamento</th>
                        <th className={styles.th}>Concepto</th>
                        <th className={styles.th}>Cobro</th>
                        <th className={styles.th}>Pagado</th>
                        <th className={styles.th}>Pendiente</th>
                        <th className={styles.th}>Estado</th>
                        <th className={styles.th}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailCharges.length === 0 ? (
                        <tr><td colSpan={8} className={styles.td} style={{ textAlign: 'center', color: 'var(--color-gray-400)' }}>Sin cobros registrados en este período</td></tr>
                      ) : sortCharges(detailCharges).map((charge) => {
                        const apt = aptMap[charge.apartment_id] || charge;
                        const status = getStatus(charge);
                        const isEditing = editingChargeId === charge.id;
                        return (
                          <tr key={charge.id} className={styles.tr}>
                            <td className={styles.checkboxTd}><input type="checkbox" className={styles.checkboxInput} checked={selectedChargeIds.includes(charge.id)} onChange={() => setSelectedChargeIds((prev) => prev.includes(charge.id) ? prev.filter((id) => id !== charge.id) : [...prev, charge.id])} /></td>
                            <td className={styles.td}>{apt.code || charge.apartment_code || '-'}</td>
                            <td className={styles.td}>{isEditing ? <input className={styles.inlineInput} value={editingConcept} onChange={(event) => setEditingConcept(event.target.value)} /> : charge.concept}</td>
                            <td className={styles.td}>{isEditing ? <input className={styles.inlineInput} type="number" min="0" step="0.01" value={editingAmount} onChange={(event) => setEditingAmount(event.target.value)} /> : formatMoney(charge.amount)}</td>
                            <td className={styles.td}>{formatMoney(charge.paid_amount || 0)}</td>
                            <td className={styles.td}>{formatMoney(charge.pending_amount || 0)}</td>
                            <td className={styles.td}><span className={`${styles.inlineBadge} ${status.className}`}>{status.label}</span></td>
                            <td className={styles.td}>
                              {isEditing ? (
                                <div className={styles.inlineActions}>
                                  <button type="button" className={styles.btnInlinePrimary} onClick={() => saveCharge(charge)} disabled={savingChargeId === charge.id}>{savingChargeId === charge.id ? 'Guardando...' : 'Guardar'}</button>
                                  <button type="button" className={styles.btnInline} onClick={cancelEdit}>Cancelar</button>
                                </div>
                              ) : (
                                <div className={styles.inlineActions}>
                                  <button type="button" className={styles.btnInline} onClick={() => startEdit(charge)}>Editar</button>
                                  <button type="button" className={styles.btnInlineDanger} onClick={() => handleDeleteCharge(charge)}>Eliminar</button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className={styles.addFeePanel}>
                  <h3 className={styles.addFeeTitle}>Asignar cobro a departamento</h3>
                  <div className={styles.addFeeForm}>
                    <select value={newChargeApartmentId} onChange={(event) => setNewChargeApartmentId(event.target.value)} className={styles.addFeeSelect}>
                      <option value="">Seleccione departamento...</option>
                      {sortApartments(apartments).map((apt) => <option key={apt.id} value={apt.id}>Depto {apt.code} ({apt.owner_name || 'Sin propietario'})</option>)}
                    </select>
                    <input type="number" min="0" step="0.01" value={newChargeAmount} onChange={(event) => setNewChargeAmount(event.target.value)} placeholder="Monto del cobro" className={styles.addFeeInput} />
                    <button type="button" onClick={handleCreateIndividual} className={styles.btnInlinePrimary} disabled={!newChargeApartmentId || !newChargeAmount || isCreatingCharge} style={{ height: '40px' }}>{isCreatingCharge ? 'Creando...' : 'Crear cobro'}</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {confirmModal.isOpen && (
        <div className={styles.overlay} onClick={closeConfirm}>
          <div className={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>{confirmModal.title}</h2>
            <p className={styles.modalSubtitle}>{confirmModal.message}</p>
            <div className={styles.bulkActions}>
              <button className={styles.btnCancel} onClick={closeConfirm}>Cancelar</button>
              <button className={styles.btnDanger} onClick={confirmModal.onConfirm}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

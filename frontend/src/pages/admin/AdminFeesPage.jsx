import { useState, useEffect } from 'react';
import { useApartmentFees } from '../../hooks/useApartmentFees';
import { useApartments } from '../../hooks/useApartments';
import PeriodSelector from '../../components/PeriodSelector/PeriodSelector';
import FormModal from '../../components/FormModal/FormModal';
import styles from './AdminFeesPage.module.css';

export default function AdminFeesPage() {
  const currentPeriod = new Date().toISOString().slice(0, 7);
  const [period, setPeriod] = useState(currentPeriod);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkValues, setBulkValues] = useState({});
  const [bulkResult, setBulkResult] = useState(null);
  const [actionError, setActionError] = useState(null);

  const { fees, loading, error, fetchFees, bulkUpload } = useApartmentFees();
  const { apartments, fetchApartments } = useApartments();

  useEffect(() => {
    fetchApartments();
  }, [fetchApartments]);

  useEffect(() => {
    if (period) fetchFees(period);
  }, [period, fetchFees]);

  const feeMap = {};
  fees.forEach((f) => { feeMap[f.apartment_id] = f.amount; });

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

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Cuotas por Período</h1>
        <div className={styles.headerActions}>
          <PeriodSelector period={period} onChange={setPeriod} label="Período:" />
          <button className={styles.btnPrimary} onClick={() => { setIsBulkOpen(true); setBulkValues({ ...feeMap }); }}>
            Carga masiva
          </button>
        </div>
      </div>

      {(error || actionError) && (
        <div className={styles.errorBanner}>{error || actionError}</div>
      )}
      {bulkResult && (
        <div className={styles.successBanner}>
          Guardado: {bulkResult.created} creados, {bulkResult.updated} actualizados
        </div>
      )}

      {loading ? (
        <p className={styles.loading}>Cargando...</p>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Departamento</th>
                <th className={styles.th}>Piso</th>
                <th className={styles.th}>Torre</th>
                <th className={styles.th}>Cuota ({period})</th>
              </tr>
            </thead>
            <tbody>
              {apartments.map((apt) => (
                <tr key={apt.id} className={styles.tr}>
                  <td className={styles.td}>{apt.code}</td>
                  <td className={styles.td}>{apt.floor ?? '—'}</td>
                  <td className={styles.td}>{apt.tower ?? '—'}</td>
                  <td className={styles.td}>
                    {feeMap[apt.id] != null
                      ? `$${Number(feeMap[apt.id]).toLocaleString()}`
                      : <span className={styles.noFee}>Sin cuota</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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

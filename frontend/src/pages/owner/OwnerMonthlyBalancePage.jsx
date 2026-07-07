import { useState } from 'react';
import MonthlyBalanceCards from '../../components/MonthlyBalanceCards/MonthlyBalanceCards';
import MonthlyBalanceChart from '../../components/MonthlyBalanceChart/MonthlyBalanceChart';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../hooks/useAuth';
import { useMonthlyBalance } from '../../hooks/useMonthlyBalance';
import { downloadOwnerMonthlyBalancePdf } from '../../services/reportService';
import styles from './OwnerMonthlyBalancePage.module.css';

function getCurrentMonthPeriod() {
  return new Date().toISOString().slice(0, 7);
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function OwnerMonthlyBalancePage() {
  const { token } = useAuth();
  const { error: notifyError } = useNotification();
  const [period, setPeriod] = useState(getCurrentMonthPeriod());
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const { data, loading, error } = useMonthlyBalance('PROPIETARIO', period);

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const blob = await downloadOwnerMonthlyBalancePdf(period, token);
      triggerDownload(blob, `balance-mensual-${period}.pdf`);
    } catch {
      notifyError('No se pudo descargar el balance en PDF.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className={styles.page}>
      <section className={styles.header}>
        <div>
          <div className={styles.badge}>Solo lectura</div>
          <h1>Balance mensual del edificio</h1>
          <p>Consulta consolidada de ingresos, gastos y balance neto del mes.</p>
        </div>

        <div className={styles.headerActions}>
          <label className={styles.monthField}>
            <span>Mes consultado</span>
            <input
              type="month"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              aria-label="Mes consultado"
            />
          </label>
          <button
            type="button"
            className={styles.pdfButton}
            onClick={handleDownloadPdf}
            disabled={downloadingPdf || loading}
          >
            {downloadingPdf ? 'Descargando...' : 'Descargar PDF'}
          </button>
        </div>
      </section>

      {error ? <div className={styles.errorBanner}>{error}</div> : null}

      <MonthlyBalanceCards summary={data} loading={loading} />
      <MonthlyBalanceChart summary={data} loading={loading} />
    </div>
  );
}

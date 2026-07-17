import { useState } from 'react';
import MonthlyBalanceCards from '../../components/MonthlyBalanceCards/MonthlyBalanceCards';
import MonthlyBalanceChart from '../../components/MonthlyBalanceChart/MonthlyBalanceChart';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../hooks/useAuth';
import { useMonthlyBalance } from '../../hooks/useMonthlyBalance';
import {
  downloadExpensesReport,
  downloadIncomeReport,
  downloadOwnerMonthlyBalancePdf,
} from '../../services/reportService';
import DownloadIcon from '../../components/icons/DownloadIcon';
import styles from './OwnerMonthlyBalancePage.module.css';

const REPORT_OPTIONS = [
  { value: 'income', label: 'Ingresos' },
  { value: 'balance', label: 'Balance ingresos y egresos' },
  { value: 'payments', label: 'Pagos' },
  { value: 'expenses', label: 'Gastos' },
];

function getCurrentMonthPeriod() {
  return new Date().toISOString().slice(0, 7);
}

function getMonthRange(period) {
  const [year, month] = period.split('-').map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return {
    start_date: start.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
  };
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
  const [selectedReport, setSelectedReport] = useState('balance');
  const [loadingExport, setLoadingExport] = useState({});
  const { data, loading, error } = useMonthlyBalance('PROPIETARIO', period);

  const REPORT_LABELS = {
    income: 'ingresos',
    balance: 'balance',
    payments: 'pagos',
    expenses: 'gastos',
  };

  const handleDownloadSelected = async (format) => {
    setLoadingExport((prev) => ({ ...prev, [format]: true }));
    try {
      const extension = format === 'excel' ? 'xlsx' : 'pdf';
      const reportParams = { ...getMonthRange(period), format };

      if (selectedReport === 'balance') {
        if (format === 'excel') {
          notifyError('El reporte de balance en Excel no está disponible para propietarios.');
          return;
        }
        const blob = await downloadOwnerMonthlyBalancePdf(period, token);
        triggerDownload(blob, `balance-mensual-${period}.pdf`);
        return;
      }

      if (selectedReport === 'payments') {
        const blob = await downloadExpensesReport(token, reportParams);
        triggerDownload(blob, `reporte-detalle-gastos-${period}.${extension}`);
        return;
      }

      if (selectedReport === 'income') {
        const blob = await downloadIncomeReport(token, reportParams);
        triggerDownload(blob, `reporte-${REPORT_LABELS[selectedReport]}-${period}.${extension}`);
        return;
      }

      if (selectedReport === 'expenses') {
        const blob = await downloadExpensesReport(token, reportParams);
        triggerDownload(blob, `reporte-${REPORT_LABELS[selectedReport]}-${period}.${extension}`);
        return;
      }

      notifyError('Este reporte no está disponible para propietarios en este módulo.');
    } catch {
      notifyError('No se pudo descargar el reporte seleccionado.');
    } finally {
      setLoadingExport((prev) => ({ ...prev, [format]: false }));
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

          <label className={styles.selectField}>
            <span>Reporte</span>
            <select value={selectedReport} onChange={(event) => setSelectedReport(event.target.value)}>
              {REPORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className={styles.btnPdf}
            onClick={() => handleDownloadSelected('pdf')}
            disabled={loadingExport.pdf || loading}
          >
            <DownloadIcon />
            {loadingExport.pdf ? 'Descargando...' : 'Descargar PDF'}
          </button>

          <button
            type="button"
            className={styles.btnExcel}
            onClick={() => handleDownloadSelected('excel')}
            disabled={loadingExport.excel || loading}
          >
            <DownloadIcon />
            {loadingExport.excel ? 'Descargando...' : 'Descargar Excel'}
          </button>
        </div>
      </section>

      {error ? <div className={styles.errorBanner}>{error}</div> : null}

      <MonthlyBalanceCards summary={data} loading={loading} />
      <MonthlyBalanceChart summary={data} loading={loading} />
    </div>
  );
}

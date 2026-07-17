import { useState, useMemo } from 'react';
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

  const [frequency, setFrequency] = useState('mensual');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedSemester, setSelectedSemester] = useState('sem1');

  // Compute params to pass to hook and services
  const balanceParams = useMemo(() => {
    if (frequency === 'mensual') {
      return { period };
    } else if (frequency === 'semestral') {
      if (selectedSemester === 'sem1') {
        return {
          start_date: `${selectedYear}-01-01`,
          end_date: `${selectedYear}-06-30`,
          period: `${selectedYear}-Sem1`
        };
      } else {
        return {
          start_date: `${selectedYear}-07-01`,
          end_date: `${selectedYear}-12-31`,
          period: `${selectedYear}-Sem2`
        };
      }
    } else { // anual
      return {
        start_date: `${selectedYear}-01-01`,
        end_date: `${selectedYear}-12-31`,
        period: `${selectedYear}-Anual`
      };
    }
  }, [frequency, period, selectedYear, selectedSemester]);

  const { data, loading, error } = useMonthlyBalance('PROPIETARIO', balanceParams);

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
      let reportParams;
      if (frequency === 'mensual') {
        reportParams = { ...getMonthRange(period), format };
      } else {
        reportParams = { start_date: balanceParams.start_date, end_date: balanceParams.end_date, format };
      }

      if (selectedReport === 'balance') {
        if (format === 'excel') {
          notifyError('El reporte de balance en Excel no está disponible para propietarios.');
          return;
        }
        const blob = await downloadOwnerMonthlyBalancePdf(balanceParams, token);
        const suffix = frequency === 'mensual' ? period : `${balanceParams.period}`;
        triggerDownload(blob, `balance-${suffix}.pdf`);
        return;
      }

      if (selectedReport === 'payments') {
        const blob = await downloadExpensesReport(token, reportParams);
        const suffix = frequency === 'mensual' ? period : `${balanceParams.period}`;
        triggerDownload(blob, `reporte-detalle-gastos-${suffix}.${extension}`);
        return;
      }

      if (selectedReport === 'income') {
        const blob = await downloadIncomeReport(token, reportParams);
        const suffix = frequency === 'mensual' ? period : `${balanceParams.period}`;
        triggerDownload(blob, `reporte-${REPORT_LABELS[selectedReport]}-${suffix}.${extension}`);
        return;
      }

      if (selectedReport === 'expenses') {
        const blob = await downloadExpensesReport(token, reportParams);
        const suffix = frequency === 'mensual' ? period : `${balanceParams.period}`;
        triggerDownload(blob, `reporte-${REPORT_LABELS[selectedReport]}-${suffix}.${extension}`);
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
          <h1>Balance {frequency === 'semestral' ? 'semestral' : frequency === 'anual' ? 'anual' : 'mensual'} del edificio</h1>
          <p>Consulta consolidada de ingresos, gastos y balance neto {frequency === 'semestral' ? 'del semestre' : frequency === 'anual' ? 'del año' : 'del mes'}.</p>
        </div>

        <div className={styles.headerActions}>
          <label className={styles.selectField}>
            <span>Frecuencia</span>
            <select value={frequency} onChange={(event) => setFrequency(event.target.value)}>
              <option value="mensual">Mensual</option>
              <option value="semestral">Semestral</option>
              <option value="anual">Anual</option>
            </select>
          </label>

          {frequency === 'mensual' && (
            <label className={styles.monthField}>
              <span>Mes consultado</span>
              <input
                type="month"
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
                aria-label="Mes consultado"
              />
            </label>
          )}

          {(frequency === 'semestral' || frequency === 'anual') && (
            <label className={styles.selectField}>
              <span>Año</span>
              <select value={selectedYear} onChange={(event) => setSelectedYear(parseInt(event.target.value, 10))}>
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((yr) => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>
            </label>
          )}

          {frequency === 'semestral' && (
            <label className={styles.selectField}>
              <span>Semestre</span>
              <select value={selectedSemester} onChange={(event) => setSelectedSemester(event.target.value)}>
                <option value="sem1">1er Semestre (Ene - Jun)</option>
                <option value="sem2">2do Semestre (Jul - Dic)</option>
              </select>
            </label>
          )}

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

      <MonthlyBalanceCards summary={data} loading={loading} periodLabel={frequency === 'semestral' ? 'del semestre' : frequency === 'anual' ? 'del año' : 'del mes'} />
      <MonthlyBalanceChart summary={data} loading={loading} periodLabel={frequency === 'semestral' ? 'del semestre' : frequency === 'anual' ? 'del año' : 'del mes'} />
    </div>
  );
}

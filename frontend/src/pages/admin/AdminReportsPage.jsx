import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '../../hooks/useAuth';
import * as reportService from '../../services/reportService';
import DownloadIcon from '../../components/icons/DownloadIcon';
import styles from './AdminReportsPage.module.css';

const CATEGORY_COLORS = ['#1155d9', '#8faef0', '#19b47b', '#9aa5bd', '#dfe3e8', '#6a7cc2'];
const REPORT_LABELS = {
  delinquency: 'morosidad',
  income: 'ingresos',
  balance: 'balance',
  payments: 'pagos',
  expenses: 'gastos',
};

const REPORT_OPTIONS = [
  { value: 'balance', label: 'Balance ingresos y egresos' },
  { value: 'income', label: 'Ingresos' },
  { value: 'expenses', label: 'Gastos' },
  { value: 'payments', label: 'Pagos' },
  { value: 'delinquency', label: 'Morosidad' },
];

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function getMonthRange(period) {
  const [year, month] = period.split('-').map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

function getCurrentMonthPeriod() {
  return new Date().toISOString().slice(0, 7);
}

function getPreviousMonthPeriod(period) {
  const [year, month] = period.split('-').map(Number);
  const previous = new Date(year, month - 2, 1);
  return `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}`;
}

function formatMoney(value) {
  return `USD ${Number(value || 0).toLocaleString('es-EC', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatShortMoney(value) {
  return `USD ${Number(value || 0).toLocaleString('es-EC', {
    maximumFractionDigits: 0,
  })}`;
}

function formatAxisMoney(value) {
  const amount = Number(value || 0);
  if (Math.abs(amount) >= 1000) return `$${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}k`;
  return `$${Math.round(amount)}`;
}

function formatChange(value) {
  const sign = Number(value) > 0 ? '+' : '';
  return `${sign}${Number(value || 0).toFixed(2)}%`;
}

function getPeriodLabel(period) {
  if (!period) return 'Resumen';
  const date = new Date(`${period}-01T00:00:00`);
  return new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' }).format(date);
}

function getChangePercent(current, previous) {
  const previousValue = Number(previous || 0);
  if (!previousValue) return 0;
  return ((Number(current || 0) - previousValue) / previousValue) * 100;
}

function formatDate(value) {
  if (!value) return '--';
  const normalized = typeof value === 'string' ? value.slice(0, 10) : value;
  const date = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function IconIncome() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 17l6-6 4 4 6-8" />
      <path d="M14 7h6v6" />
      <path d="M4 21h16" />
    </svg>
  );
}

function IconExpense() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7l6 6 4-4 6 8" />
      <path d="M14 17h6v-6" />
      <path d="M4 3h16" />
    </svg>
  );
}

function IconWallet() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h15a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12" />
      <path d="M16 13h5" />
      <circle cx="17" cy="13" r="1" />
    </svg>
  );
}

function IconRecover() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19" />
      <circle cx="10" cy="7" r="4" />
      <circle cx="18" cy="15" r="3" />
      <path d="M18 13.5v3" />
      <path d="M16.5 15h3" />
    </svg>
  );
}

function IconPercent() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19 5L5 19" />
      <circle cx="7" cy="7" r="2.2" />
      <circle cx="17" cy="17" r="2.2" />
    </svg>
  );
}

export default function AdminReportsPage() {
  const { token } = useAuth();
  const { building } = useOutletContext() || {};
  const buildingName = building?.name || 'edificio';
  const initialPeriod = useMemo(() => getCurrentMonthPeriod(), []);
  const [period, setPeriod] = useState(initialPeriod);
  const [comparePeriod, setComparePeriod] = useState(getPreviousMonthPeriod(initialPeriod));
  const [{ startDate, endDate }, setDateRange] = useState(getMonthRange(initialPeriod));
  const [stats, setStats] = useState(null);
  const [comparisonStats, setComparisonStats] = useState(null);
  const [selectedReport, setSelectedReport] = useState('balance');
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingExport, setLoadingExport] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    setDateRange(getMonthRange(period));
  }, [period]);

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      setLoadingStats(true);
      setError(null);
      try {
        const compareRange = getMonthRange(comparePeriod);
        const [currentData, previousData] = await Promise.all([
          reportService.getDashboardStats(token, { start_date: startDate, end_date: endDate }),
          reportService.getDashboardStats(token, {
            start_date: compareRange.startDate,
            end_date: compareRange.endDate,
          }),
        ]);
        if (!cancelled) {
          setStats(currentData);
          setComparisonStats(previousData);
        }
      } catch {
        if (!cancelled) setError('Error al cargar estadísticas de reportes.');
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    }

    loadStats();
    return () => {
      cancelled = true;
    };
  }, [token, startDate, endDate, comparePeriod]);

  const handleDownloadSelected = async (format) => {
    setLoadingExport((prev) => ({ ...prev, [format]: true }));
    setError(null);
    try {
      const params = { start_date: startDate, end_date: endDate, format };
      const downloads = {
        delinquency: () => reportService.downloadDelinquencyReport(token, { format }),
        income: () => reportService.downloadIncomeReport(token, params),
        balance: () => reportService.downloadBalanceReport(token, params),
        payments: () => reportService.downloadPaymentsReport(token, params),
        expenses: () => reportService.downloadExpensesReport(token, params),
      };
      const blob = await downloads[selectedReport]();
      const ext = format === 'excel' ? 'xlsx' : 'pdf';
      triggerDownload(blob, `reporte-${REPORT_LABELS[selectedReport]}-${startDate}-${endDate}.${ext}`);
    } catch (err) {
      setError(err.message || 'Error al generar la descarga. Intenta nuevamente.');
    } finally {
      setLoadingExport((prev) => ({ ...prev, [format]: false }));
    }
  };

  const summary = stats?.summary || {};
  const comparisonSummary = comparisonStats?.summary || {};
  const categories = stats?.expense_categories || [];
  const monthly = stats?.monthly || [];
  const comparisonMonthly = comparisonStats?.monthly || [];
  const feeDetails = stats?.fee_details || [];
  const expenseDetails = stats?.expense_details || [];

  const currentExpected = monthly.at(-1)?.expected || 0;
  const currentCollected = monthly.at(-1)?.collected || summary.total_revenue || 0;
  const comparisonExpected = comparisonMonthly.at(-1)?.expected || 0;
  const comparisonCollected = comparisonMonthly.at(-1)?.collected || comparisonSummary.total_revenue || 0;
  const recoverable = Math.max(currentExpected - currentCollected, 0);
  const comparisonRecoverable = Math.max(comparisonExpected - comparisonCollected, 0);
  const efficiency = currentExpected ? (currentCollected / currentExpected) * 100 : 0;
  const comparisonEfficiency = comparisonExpected ? (comparisonCollected / comparisonExpected) * 100 : 0;

  const metrics = [
    {
      label: 'Ingresos totales',
      value: formatMoney(summary.total_revenue),
      change: getChangePercent(summary.total_revenue, comparisonSummary.total_revenue),
      tone: 'income',
      Icon: IconIncome,
    },
    {
      label: 'Gastos totales',
      value: formatMoney(summary.total_expenses),
      change: getChangePercent(summary.total_expenses, comparisonSummary.total_expenses),
      tone: 'expense',
      Icon: IconExpense,
      inverse: true,
    },
    {
      label: 'Balance neto',
      value: formatMoney(summary.net_income),
      change: getChangePercent(summary.net_income, comparisonSummary.net_income),
      tone: 'balance',
      Icon: IconWallet,
    },
    {
      label: 'Valor por recuperar',
      value: formatMoney(recoverable),
      change: getChangePercent(recoverable, comparisonRecoverable),
      tone: 'recover',
      Icon: IconRecover,
      inverse: true,
    },
    {
      label: 'Eficiencia recaudación',
      value: `${efficiency.toFixed(2)}%`,
      change: efficiency - comparisonEfficiency,
      tone: 'efficiency',
      Icon: IconPercent,
    },
  ];

  const comparisonChart = [
    { name: 'Ingreso efectivo', actual: summary.total_revenue || 0, comparativo: comparisonSummary.total_revenue || 0 },
    { name: 'Gastos', actual: summary.total_expenses || 0, comparativo: comparisonSummary.total_expenses || 0 },
    { name: 'Resultado', actual: summary.net_income || 0, comparativo: comparisonSummary.net_income || 0 },
    { name: 'Valores por recuperar', actual: recoverable, comparativo: comparisonRecoverable },
    { name: 'Eficiencia', actual: efficiency, comparativo: comparisonEfficiency, percent: true },
  ];

  const emittedVsCollected = [
    { period: getPeriodLabel(comparePeriod), expected: comparisonExpected, collected: comparisonCollected },
    { period: getPeriodLabel(period), expected: currentExpected, collected: currentCollected },
  ];

  return (
    <div className={styles.page}>
      <section className={styles.header}>
        <div>
          <h1>Reportes financieros</h1>
          <p>Genera y consulta los reportes financieros del {buildingName}.</p>
        </div>
      </section>

      <section className={styles.actions}>
        <label className={styles.dateField}>
          <span>Periodo</span>
          <input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} />
        </label>
        <label className={styles.dateField}>
          <span>Comparar con</span>
          <input type="month" value={comparePeriod} onChange={(event) => setComparePeriod(event.target.value)} />
        </label>
        <label className={styles.selectField}>
          <span>Tipo de reporte</span>
          <select value={selectedReport} onChange={(event) => setSelectedReport(event.target.value)}>
            {REPORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <button className={styles.btnPdf} onClick={() => handleDownloadSelected('pdf')} disabled={loadingExport.pdf}>
          <DownloadIcon />
          {loadingExport.pdf ? 'Descargando...' : 'Descargar PDF'}
        </button>
        <button className={styles.btnExcel} onClick={() => handleDownloadSelected('excel')} disabled={loadingExport.excel}>
          <DownloadIcon />
          {loadingExport.excel ? 'Descargando...' : 'Descargar Excel'}
        </button>
      </section>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <section className={styles.statsGrid} aria-busy={loadingStats}>
        {metrics.map((metric) => {
          const isGood = metric.inverse ? metric.change <= 0 : metric.change >= 0;
          return (
            <article className={styles.metricCard} key={metric.label}>
              <i className={`${styles.metricIcon} ${styles[`${metric.tone}Icon`]}`}><metric.Icon /></i>
              <div>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <em className={isGood ? styles.positive : styles.negative}>{formatChange(metric.change)}</em>
                <small>vs. mes anterior</small>
              </div>
            </article>
          );
        })}
      </section>

      <section className={styles.chartGrid}>
        <article className={`${styles.panel} ${styles.comparisonPanel}`}>
          <div className={styles.panelHeader}>
            <h2>Comparativo del mes</h2>
          </div>
          <ResponsiveContainer width="100%" height={218}>
            <BarChart data={comparisonChart} barGap={7} barCategoryGap="24%" margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#e7ebf3" vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} interval={0} height={34} />
              <YAxis width={52} tickFormatter={(value) => (Math.abs(value) <= 100 ? `${Math.round(value)}` : formatAxisMoney(value))} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} domain={[0, (dataMax) => Math.ceil(dataMax * 1.15)]} />
              <Tooltip formatter={(value, name, item) => (item?.payload?.percent ? `${Number(value).toFixed(2)}%` : formatMoney(value))} />
              <Legend verticalAlign="top" align="center" height={28} iconType="square" />
              <Bar dataKey="comparativo" name={getPeriodLabel(comparePeriod)} fill="#b9cdfb" radius={[5, 5, 0, 0]} maxBarSize={38} />
              <Bar dataKey="actual" name={getPeriodLabel(period)} fill="#1155d9" radius={[5, 5, 0, 0]} maxBarSize={38} />
            </BarChart>
          </ResponsiveContainer>
        </article>

        <article className={styles.panel}>
          <h2>Categorías de gastos</h2>
          <div className={styles.donutLayout}>
            <ResponsiveContainer width="42%" height={164}>
              <PieChart>
                <Pie data={categories} dataKey="amount" nameKey="category" innerRadius={38} outerRadius={60} paddingAngle={1}>
                  {categories.map((entry, index) => (
                    <Cell key={entry.category} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatMoney(value)} />
              </PieChart>
            </ResponsiveContainer>
            <div className={styles.categoryLegend}>
              {categories.slice(0, 4).map((item, index) => (
                <span key={item.category}>
                  <i style={{ background: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }} />
                  <b>{item.category}</b>
                  <small>{formatMoney(item.amount)}</small>
                </span>
              ))}
            </div>
          </div>
          <div className={styles.totalStrip}>
            <span>Total egresos</span>
            <strong>{formatMoney(summary.total_expenses)}</strong>
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Emitido vs cobrado</h2>
          </div>
          <ResponsiveContainer width="100%" height={202}>
            <BarChart data={emittedVsCollected} barGap={10} barCategoryGap="32%" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#ebedf2" vertical={false} />
              <XAxis dataKey="period" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} height={30} />
              <YAxis width={48} tickFormatter={(value) => formatAxisMoney(value)} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} domain={[0, (dataMax) => Math.ceil(dataMax * 1.15)]} />
              <Tooltip formatter={(value) => formatMoney(value)} />
              <Legend verticalAlign="top" align="center" height={28} iconType="square" />
              <Bar dataKey="expected" name="Emitido" fill="#b9cdfb" radius={[5, 5, 0, 0]} maxBarSize={36} />
              <Bar dataKey="collected" name="Cobrado" fill="#1155d9" radius={[5, 5, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </article>
      </section>

      <section className={styles.detailGrid}>
        <article className={styles.tablePanel}>
          <div className={styles.tableTitle}>
            <h2>Detalle de alícuotas <small>(por departamento)</small></h2>
          </div>
          <div className={styles.tableScroller}>
            <table>
              <thead>
                <tr>
                  <th>Departamento</th>
                  <th>Propietario</th>
                  <th>Monto (USD)</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {feeDetails.length ? feeDetails.slice(0, 5).map((row) => (
                  <tr key={`${row.period}-${row.apartment_code}-${row.owner_name}`}>
                    <td>{row.apartment_code}</td>
                    <td>{row.owner_name}</td>
                    <td>{formatMoney(row.amount)}</td>
                    <td>
                      <span className={row.status === 'PAGADA' ? styles.statusPaid : styles.statusPending}>
                        {row.status === 'PAGADA' ? 'Pagado' : 'Pendiente'}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="4" className={styles.emptyCell}>Sin alícuotas en el período</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="2">Total recaudado</td>
                  <td>{formatMoney(currentCollected)}</td>
                  <td />
                </tr>
                <tr>
                  <td colSpan="2">Total proyectado (alícuotas)</td>
                  <td>{formatMoney(currentExpected)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </article>

        <article className={styles.tablePanel}>
          <div className={styles.tableTitle}>
            <h2>Detalle de gastos <small>(por movimiento)</small></h2>
          </div>
          <div className={styles.tableScroller}>
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Concepto</th>
                  <th>Categoría</th>
                  <th>Monto (USD)</th>
                </tr>
              </thead>
              <tbody>
                {expenseDetails.length ? expenseDetails.map((row) => (
                  <tr key={`${row.date}-${row.concept}-${row.amount}`}>
                    <td>{formatDate(row.date)}</td>
                    <td>{row.concept}</td>
                    <td>{row.category}</td>
                    <td>{formatMoney(row.amount)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="4" className={styles.emptyCell}>Sin gastos en el período</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="3">Total egresos del mes</td>
                  <td>{formatMoney(summary.total_expenses)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </article>
      </section>
    </div>
  );
}

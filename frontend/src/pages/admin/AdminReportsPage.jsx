import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '../../hooks/useAuth';
import * as reportService from '../../services/reportService';
import styles from './AdminReportsPage.module.css';

const REPORTS = ['delinquency', 'income', 'balance'];
const CATEGORY_COLORS = ['#1155d9', '#b9c3de', '#81889e', '#121b2d', '#dfe3e8', '#6a7cc2'];
const REPORT_LABELS = {
  delinquency: 'morosidad',
  income: 'ingresos',
  balance: 'balance',
};

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function getQuarterRange() {
  const now = new Date();
  const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
  const start = new Date(now.getFullYear(), quarterStartMonth, 1);
  const end = now;
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

function formatCurrency(value) {
  return `$${Number(value || 0).toLocaleString('es-EC', {
    maximumFractionDigits: 0,
  })}`;
}

function formatChange(value) {
  if (value === null || value === undefined) return '0.0%';
  const sign = Number(value) > 0 ? '+' : '';
  return `${sign}${Number(value).toFixed(1)}%`;
}

function getRangeLabel(startDate) {
  if (!startDate) return 'Resumen';
  const date = new Date(`${startDate}T00:00:00`);
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return `Resumen T${quarter} ${date.getFullYear()}`;
}

function getRiskLabel(riskLevel) {
  const labels = { High: 'Alto', Medium: 'Medio', Low: 'Bajo' };
  return labels[riskLevel] || riskLevel;
}

function IconDownload() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconSheet() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
      <path d="M9 21V9" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <polyline points="3 7 12 13 21 7" />
    </svg>
  );
}

export default function AdminReportsPage() {
  const { token } = useAuth();
  const initialRange = useMemo(() => getQuarterRange(), []);
  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingExport, setLoadingExport] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function loadStats() {
      setLoadingStats(true);
      setError(null);
      try {
        const data = await reportService.getDashboardStats(token, { start_date: startDate, end_date: endDate });
        if (!cancelled) setStats(data);
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
  }, [token, startDate, endDate]);

  const handleDownloadAll = async (format) => {
    setLoadingExport((prev) => ({ ...prev, [format]: true }));
    setError(null);
    try {
      const params = { start_date: startDate, end_date: endDate, format };
      const downloads = {
        delinquency: () => reportService.downloadDelinquencyReport(token, { format }),
        income: () => reportService.downloadIncomeReport(token, params),
        balance: () => reportService.downloadBalanceReport(token, params),
      };
      for (const report of REPORTS) {
        const blob = await downloads[report]();
        const ext = format === 'excel' ? 'xlsx' : 'pdf';
        triggerDownload(blob, `reporte-${REPORT_LABELS[report]}-${startDate}-${endDate}.${ext}`);
      }
    } catch {
      setError('Error al generar la descarga. Intenta nuevamente.');
    } finally {
      setLoadingExport((prev) => ({ ...prev, [format]: false }));
    }
  };

  const summary = stats?.summary || {};
  const categories = stats?.expense_categories || [];
  const monthly = stats?.monthly || [];
  const arrears = stats?.arrears || [];
  const highRisk = stats?.risk_summary?.high || 0;

  return (
    <div className={styles.page}>
      <section className={styles.header}>
        <div>
          <h1>Reportes financieros</h1>
          <p>{getRangeLabel(startDate)} de Edificio Horizonte</p>
        </div>
        <div className={styles.actions}>
          <label className={styles.dateField}>
            <span>Inicio</span>
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label className={styles.dateField}>
            <span>Fin</span>
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
          <button className={styles.btnPdf} onClick={() => handleDownloadAll('pdf')} disabled={loadingExport.pdf}>
            <IconDownload />
            {loadingExport.pdf ? 'Exportando...' : 'Exportar PDF'}
          </button>
          <button className={styles.btnExcel} onClick={() => handleDownloadAll('excel')} disabled={loadingExport.excel}>
            <IconSheet />
            {loadingExport.excel ? 'Exportando...' : 'Exportar Excel'}
          </button>
        </div>
      </section>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <section className={styles.statsGrid} aria-busy={loadingStats}>
        <article className={styles.metricCard}>
          <span>Ingresos totales</span>
          <div>
            <strong>{formatCurrency(summary.total_revenue)}</strong>
            <em className={styles.positive}>{formatChange(summary.revenue_change_percent)}</em>
          </div>
        </article>
        <article className={styles.metricCard}>
          <span>Gastos totales</span>
          <div>
            <strong>{formatCurrency(summary.total_expenses)}</strong>
            <em className={styles.negative}>{formatChange(summary.expense_change_percent)}</em>
          </div>
        </article>
        <article className={`${styles.metricCard} ${styles.netCard}`}>
          <span>Ingreso neto</span>
          <div>
            <strong>{formatCurrency(summary.net_income)}</strong>
          </div>
        </article>
      </section>

      <section className={styles.chartGrid}>
        <article className={styles.panel}>
          <h2>Categorías de gastos</h2>
          <div className={styles.donutWrap}>
            {categories.length ? (
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie data={categories} dataKey="amount" nameKey="category" innerRadius={58} outerRadius={92} paddingAngle={0}>
                    {categories.map((entry, index) => (
                      <Cell key={entry.category} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className={styles.emptyState}>Sin gastos en el rango</div>
            )}
          </div>
          <div className={styles.legend}>
            {categories.slice(0, 6).map((item, index) => (
              <span key={item.category}>
                <i style={{ background: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }} />
                {item.category}
              </span>
            ))}
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Emitido vs cobrado</h2>
            <span>{getRangeLabel(startDate).replace('Resumen ', '')}</span>
          </div>
          {monthly.length ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthly} barGap={6}>
                <CartesianGrid stroke="#ebedf2" vertical={false} />
                <XAxis dataKey="period" tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(value) => `$${Math.round(value / 1000)}k`} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Bar dataKey="expected" name="Emitido" fill="#dfe3e8" radius={[5, 5, 0, 0]} />
                <Bar dataKey="collected" name="Cobrado" fill="#1155d9" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className={styles.emptyState}>Sin datos mensuales</div>
          )}
          <div className={styles.legend}>
            <span><i className={styles.grayDot} />Emitido</span>
            <span><i className={styles.blueDot} />Cobrado</span>
          </div>
        </article>
      </section>

      <section className={styles.tablePanel}>
        <div className={styles.tableTitle}>
          <h2>Mora y saldos pendientes</h2>
          <span>Riesgo alto: {highRisk}</span>
        </div>
        <div className={styles.tableScroller}>
          <table>
            <thead>
              <tr>
                <th>Unidad</th>
                <th>Propietario</th>
                <th>Monto pendiente</th>
                <th>Vencimiento</th>
                <th>Riesgo</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {arrears.length ? arrears.map((row) => (
                <tr key={`${row.unit}-${row.owner}`}>
                  <td>{row.unit}</td>
                  <td>{row.owner}</td>
                  <td>{formatCurrency(row.amount_due)}</td>
                  <td>{row.days_overdue}</td>
                  <td><span className={styles[`risk${row.risk_level}`]}>{getRiskLabel(row.risk_level)}</span></td>
                  <td>
                    {row.email ? (
                      <a className={styles.mailBtn} href={`mailto:${row.email}`} aria-label={`Enviar correo a ${row.owner}`}>
                        <IconMail />
                      </a>
                    ) : null}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6" className={styles.emptyCell}>No hay saldos pendientes</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

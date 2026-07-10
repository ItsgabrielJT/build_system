import { useState, useEffect } from 'react';
import { useAccountStatement } from '../../hooks/useAccountStatement';
import DateRangePicker from '../../components/DateRangePicker/DateRangePicker';
import DelinquencyBadge from '../../components/DelinquencyBadge/DelinquencyBadge';
import styles from './OwnerAccountStatementPage.module.css';

function formatCurrency(value) {
  return `$${Number(value || 0).toLocaleString()}`;
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

export default function OwnerAccountStatementPage() {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const defaultStart = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
  const defaultEnd = now.toISOString().slice(0, 7);

  const [range, setRange] = useState({ startPeriod: defaultStart, endPeriod: defaultEnd });
  const { statement, loading, exporting, exportingFormat, error, fetchStatement, exportStatement } = useAccountStatement();

  useEffect(() => {
    if (range.startPeriod && range.endPeriod) {
      fetchStatement({ start_period: range.startPeriod, end_period: range.endPeriod });
    }
  }, [range, fetchStatement]);

  const handleExport = async (format) => {
    const blob = await exportStatement(format, {
      start_period: range.startPeriod,
      end_period: range.endPeriod,
    });
    if (!blob) return;
    const extension = format === 'excel' ? 'xlsx' : 'pdf';
    triggerDownload(blob, `estado-cuenta-${range.startPeriod}-${range.endPeriod}.${extension}`);
  };

  const totals = statement.reduce(
    (acc, row) => ({
      esperado: acc.esperado + (row.esperado || 0),
      multas: acc.multas + (row.multas || 0),
      pagado: acc.pagado + (row.pagado || 0),
      saldo: acc.saldo + (row.saldo || 0),
    }),
    { esperado: 0, multas: 0, pagado: 0, saldo: 0 }
  );
  const periodsInDebt = statement.filter((row) => Number(row.saldo || 0) > 0).length;
  const periodsPaid = statement.filter((row) => Number(row.saldo || 0) <= 0).length;
  const avgPayment = statement.length ? totals.pagado / statement.length : 0;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>Mi Estado de Cuenta</h1>
          <p className={styles.subtitle}>
            Consulte sus movimientos por período y descargue su estado en formatos oficiales.
          </p>
        </div>

        <section className={styles.metricsGrid}>
          <article className={styles.metricCard}>
            <div className={`${styles.metricIconContainer} ${styles.metricDangerIcon}`}>
              <span className={styles.metricIconSymbol}>$</span>
            </div>
            <div className={styles.metricDetails}>
              <span className={styles.metricLabelText}>Saldo pendiente</span>
              <strong className={styles.textDanger}>{formatCurrency(totals.saldo)}</strong>
              <small className={styles.metricSubText}>
                {periodsInDebt > 0 ? `${periodsInDebt} períodos en mora` : 'Cuenta al día'}
              </small>
            </div>
          </article>
          <article className={styles.metricCard}>
            <div className={`${styles.metricIconContainer} ${styles.metricSuccessIcon}`}>
              <svg className={styles.metricSvg} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M7 12h10M9 17h6" />
              </svg>
            </div>
            <div className={styles.metricDetails}>
              <span className={styles.metricLabelText}>Total pagado</span>
              <strong className={styles.textSuccess}>{formatCurrency(totals.pagado)}</strong>
              <small className={styles.metricSubText}>{periodsPaid} períodos al día</small>
            </div>
          </article>
          <article className={styles.metricCard}>
            <div className={`${styles.metricIconContainer} ${styles.metricInfoIcon}`}>
              <svg className={styles.metricSvg} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v8m-4-4h8" />
              </svg>
            </div>
            <div className={styles.metricDetails}>
              <span className={styles.metricLabelText}>Promedio pagado</span>
              <strong className={styles.textInfo}>{formatCurrency(avgPayment)}</strong>
              <small className={styles.metricSubText}>Por período seleccionado</small>
            </div>
          </article>
        </section>
      </div>

      <section className={styles.filterCard}>
        <div>
          <h2 className={styles.sectionTitle}>Filtros y exportación</h2>
          <p className={styles.sectionDescription}>Defina el rango de períodos y descargue la información.</p>
        </div>
        <div className={styles.filterActions}>
          <DateRangePicker
            startPeriod={range.startPeriod}
            endPeriod={range.endPeriod}
            onChange={setRange}
            label="Rango de períodos:"
          />
          <div className={styles.exportActions}>
            <button
              className={styles.btnPdf}
              onClick={() => handleExport('pdf')}
              disabled={exporting}
            >
              {exportingFormat === 'pdf' ? 'Descargando...' : 'Descargar PDF'}
            </button>
            <button
              className={styles.btnExcel}
              onClick={() => handleExport('excel')}
              disabled={exporting}
            >
              {exportingFormat === 'excel' ? 'Descargando...' : 'Descargar Excel'}
            </button>
          </div>
        </div>
      </section>

      {error && <div className={styles.errorBanner}>{error}</div>}

      {loading ? (
        <p className={styles.loading}>Cargando estado de cuenta...</p>
      ) : (
        <section className={styles.tableSection}>
          <h2 className={styles.sectionTitle}>Detalle de movimientos</h2>
          <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Período</th>
                <th className={styles.th}>Departamento</th>
                <th className={styles.th}>Esperado</th>
                <th className={styles.th}>Multas</th>
                <th className={styles.th}>Pagado</th>
                <th className={styles.th}>Saldo</th>
                <th className={styles.th}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {statement.map((row, i) => (
                <tr key={i} className={styles.tr}>
                  <td className={styles.td}>{row.period}</td>
                  <td className={styles.td}>{row.apartment_code}</td>
                  <td className={styles.td}>{formatCurrency(row.esperado)}</td>
                  <td className={styles.td}>{formatCurrency(row.multas)}</td>
                  <td className={styles.td}>{formatCurrency(row.pagado)}</td>
                  <td className={styles.td}>
                    <strong style={{ color: row.saldo > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                      {formatCurrency(row.saldo)}
                    </strong>
                  </td>
                  <td className={styles.td}>
                    <DelinquencyBadge status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
            {statement.length > 0 && (
              <tfoot>
                <tr className={styles.totalsRow}>
                  <td className={styles.tdTotals} colSpan={2}>TOTALES</td>
                  <td className={styles.tdTotals}>{formatCurrency(totals.esperado)}</td>
                  <td className={styles.tdTotals}>{formatCurrency(totals.multas)}</td>
                  <td className={styles.tdTotals}>{formatCurrency(totals.pagado)}</td>
                  <td className={styles.tdTotals}>
                    <strong style={{ color: totals.saldo > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                      {formatCurrency(totals.saldo)}
                    </strong>
                  </td>
                  <td className={styles.tdTotals} />
                </tr>
              </tfoot>
            )}
          </table>
          {!statement.length && (
            <p className={styles.empty}>Sin movimientos para el rango seleccionado.</p>
          )}
          </div>
        </section>
      )}
    </div>
  );
}

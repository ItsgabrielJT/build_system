import { useState } from 'react';
import styles from './PeriodsHistoryTable.module.css';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const STATUS_ICONS = {
  ABIERTO: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  VENCIDO: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  CERRADO: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
};

const EYE_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const CHART_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

function formatPeriodLabel(period) {
  if (!period) return period;
  const [year, month] = period.split('-');
  return `${MONTH_NAMES[parseInt(month, 10) - 1]} ${year}`;
}

function formatMoney(value) {
  if (value == null) return '—';
  return `$${Number(value).toLocaleString('es-CL')}`;
}

function getPageNumbers(current, total) {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total]);
  for (let i = Math.max(1, current - 1); i <= Math.min(total, current + 1); i++) {
    pages.add(i);
  }
  return Array.from(pages).sort((a, b) => a - b);
}

export default function PeriodsHistoryTable({
  data = [],
  loading,
  total = 0,
  page = 1,
  pageSize = 10,
  onPageChange,
  onFilterYear,
  onExport,
  onViewDetail,
  onViewChart,
}) {
  const totalPages = Math.ceil(total / pageSize);
  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);
  const pageNumbers = getPageNumbers(page, totalPages);

  const [filterYear, setFilterYear] = useState(null);
  const [showYearMenu, setShowYearMenu] = useState(false);

  const currentYear = new Date().getFullYear();
  const yearOptions = [null, currentYear, currentYear - 1, currentYear - 2, currentYear - 3];

  const handleYearSelect = (y) => {
    setFilterYear(y);
    setShowYearMenu(false);
    onFilterYear && onFilterYear(y);
  };

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Historial de Períodos</h2>
        <div className={styles.sectionActions}>
          <div className={styles.yearFilterWrapper}>
            <button
              className={styles.btnOutline}
              onClick={() => setShowYearMenu((v) => !v)}
            >
              ≡ {filterYear ? `Año ${filterYear}` : 'Filtrar Año'}
            </button>
            {showYearMenu && (
              <div className={styles.yearMenu}>
                {yearOptions.map((y) => (
                  <button
                    key={y ?? 'all'}
                    className={`${styles.yearMenuItem} ${filterYear === y ? styles.yearMenuItemActive : ''}`}
                    onClick={() => handleYearSelect(y)}
                  >
                    {y ? String(y) : 'Todos los años'}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className={styles.btnOutline} onClick={onExport}>
            ↓ Exportar Todo
          </button>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        {loading ? (
          <p className={styles.loading}>Cargando períodos...</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>PERÍODO</th>
                <th className={styles.th}>ESTADO</th>
                <th className={styles.th}>EMITIDO</th>
                <th className={styles.th}>RECAUDADO</th>
                <th className={styles.th}>MOROSIDAD</th>
                <th className={styles.th}>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={6} className={styles.emptyCell}>
                    No hay períodos registrados
                  </td>
                </tr>
              ) : (
                data.map((row) => {
                  const status = (row.estado || 'CERRADO').toUpperCase();
                  const delinquencyPct = row.morosidad_pct ?? 0;
                  return (
                    <tr key={row.period} className={styles.tr}>
                      <td className={styles.td}>
                        <div className={styles.periodCell}>
                          <span className={`${styles.periodIcon} ${styles[`status_${status}`]}`}>
                            {STATUS_ICONS[status] ?? STATUS_ICONS.CERRADO}
                          </span>
                          <div>
                            <div className={styles.periodName}>{row.label || formatPeriodLabel(row.period)}</div>
                            {row.vencimiento && (
                              <div className={styles.periodDue}>Vto: {row.vencimiento}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className={styles.td}>
                        <span className={`${styles.statusBadge} ${styles[`badge_${status}`]}`}>
                          {status}
                        </span>
                      </td>
                      <td className={styles.td}>{formatMoney(row.total_emitido)}</td>
                      <td className={styles.td}>{formatMoney(row.total_recaudado)}</td>
                      <td className={styles.td}>
                        <div className={styles.delinquencyCell}>
                          <span className={styles.delinquencyPct}>{delinquencyPct.toFixed(1)}%</span>
                          <div className={styles.miniBar}>
                            <div
                              className={`${styles.miniBarFill} ${delinquencyPct > 30 ? styles.miniBarRed : styles.miniBarBlue}`}
                              style={{ width: `${Math.min(delinquencyPct, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className={styles.td}>
                        <div className={styles.actions}>
                          <button
                            className={styles.actionBtn}
                            title="Ver detalle"
                            onClick={() => onViewDetail && onViewDetail(row)}
                          >
                            {EYE_ICON}
                          </button>
                          <button
                            className={styles.actionBtn}
                            title="Ver gráfico"
                            onClick={() => onViewChart && onViewChart(row)}
                          >
                            {CHART_ICON}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {total > 0 && (
        <div className={styles.pagination}>
          <span className={styles.paginationInfo}>
            Mostrando {startItem}-{endItem} de {total} períodos
          </span>
          <div className={styles.paginationControls}>
            <button
              className={styles.pageBtn}
              onClick={() => onPageChange && onPageChange(page - 1)}
              disabled={page <= 1}
            >
              ←
            </button>
            {pageNumbers.map((p, idx) => {
              const prev = pageNumbers[idx - 1];
              return (
                <span key={p} className={styles.pageGroup}>
                  {prev != null && p - prev > 1 && (
                    <span className={styles.pageDots}>…</span>
                  )}
                  <button
                    className={`${styles.pageBtn} ${p === page ? styles.pageBtnActive : ''}`}
                    onClick={() => onPageChange && onPageChange(p)}
                  >
                    {p}
                  </button>
                </span>
              );
            })}
            <button
              className={styles.pageBtn}
              onClick={() => onPageChange && onPageChange(page + 1)}
              disabled={page >= totalPages}
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

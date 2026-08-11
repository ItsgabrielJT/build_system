import { useEffect, useMemo, useState } from 'react';
import { useDelinquency } from '../../hooks/useDelinquency';
import styles from './AdminDelinquencyPage.module.css';

const money = (value) => `$${Number(value || 0).toLocaleString()}`;
const PAGE_SIZE = 4;
const moneyWithCents = (value) => `$${Number(value || 0).toLocaleString(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;
const LATE_INTEREST_START_PERIOD = '2026-08';

const IconTrend = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </svg>
);

const IconUsers = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const IconCalculator = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <rect x="8" y="7" width="8" height="3" />
    <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
  </svg>
);

const IconFilter = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 5h18M7 12h10M10 19h4" />
  </svg>
);

const IconDownload = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const IconChevron = ({ direction = 'right' }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={direction === 'left' ? styles.chevronLeft : ''}>
    <path d="m9 18 6-6-6-6" />
  </svg>
);

function StatCard({ tone, label, value, subtext, icon, progress }) {
  return (
    <section className={`${styles.statCard} ${styles[tone]}`}>
      <div>
        <p className={styles.statLabel}>{label}</p>
        <strong className={styles.statValue}>{value}</strong>
      </div>
      <span className={styles.statIcon}>{icon}</span>
      {progress !== undefined && (
        <div className={styles.progressTrack}>
          <span style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>
      )}
      <p className={styles.statSubtext}>{subtext}</p>
    </section>
  );
}

function AgingBar({ label, percent, color }) {
  return (
    <div className={styles.agingRow}>
      <div className={styles.agingMeta}>
        <span>{label}</span>
        <strong>{Math.round(percent || 0)}%</strong>
      </div>
      <div className={styles.agingTrack}>
        <span style={{ width: `${Math.min(percent || 0, 100)}%`, background: color }} />
      </div>
    </div>
  );
}

function interestCell(period) {
  const startPeriod = period.interes_mora_aplica_desde || LATE_INTEREST_START_PERIOD;
  const missingRates = period.tasas_faltantes || [];
  if (period.period < startPeriod) {
    return <span className={styles.mutedValue}>No aplica</span>;
  }
  if (missingRates.length) {
    return <span className={styles.warningValue}>Falta tasa BCE</span>;
  }
  return moneyWithCents(period.interes_mora);
}

function interestStatus(period) {
  const startPeriod = period.interes_mora_aplica_desde || LATE_INTEREST_START_PERIOD;
  const missingRates = period.tasas_faltantes || [];
  if (period.period < startPeriod) return 'Fuera de vigencia';
  if (period.status !== 'OVERDUE') return 'Sin mora';
  if (missingRates.length) return `Registrar tasa ${missingRates.join(', ')}`;
  if (Number(period.interes_mora || 0) > 0) return 'Interés generado';
  return 'Pendiente de acumulación';
}

export default function AdminDelinquencyPage() {
  const {
    delinquentOwners,
    delinquencyStats,
    loading,
    error,
    fetchDelinquentOwners,
    fetchOwnerDetail,
    fetchDelinquencyStats,
  } = useDelinquency();
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');
  const [agingFilter, setAgingFilter] = useState('all');
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchDelinquentOwners({ status: 'OVERDUE' });
    fetchDelinquencyStats?.();
  }, [fetchDelinquentOwners, fetchDelinquencyStats]);

  const fallbackUnits = useMemo(
    () =>
      delinquentOwners.map((owner) => ({
        apartment_id: owner.id,
        unit: owner.departamentos?.[0] || owner.apartment_code || 'Unidad',
        owner_name: owner.owner_name || owner.full_name,
        email: owner.email,
        '30_days': owner.deuda_total || 0,
        '60_days': 0,
        '90_plus_days': 0,
        total_debt: owner.deuda_total || 0,
      })),
    [delinquentOwners]
  );

  const summary = delinquencyStats?.summary || {
    total_debt: fallbackUnits.reduce((acc, unit) => acc + unit.total_debt, 0),
    debt_change_percent: 0,
    delinquent_units: fallbackUnits.length,
    total_units: 0,
    affected_percent: 0,
    average_debt: fallbackUnits.length
      ? fallbackUnits.reduce((acc, unit) => acc + unit.total_debt, 0) / fallbackUnits.length
      : 0,
  };
  const aging = delinquencyStats?.aging || {
    '30_days': { percent: 100 },
    '60_days': { percent: 0 },
    '90_plus_days': { percent: 0 },
  };
  const units = delinquencyStats?.units?.length ? delinquencyStats.units : fallbackUnits;

  const filteredUnits = useMemo(() => {
    const query = search.trim().toLowerCase();
    return units.filter((unit) => {
      const matchesQuery =
        !query ||
        unit.unit?.toLowerCase().includes(query) ||
        unit.owner_name?.toLowerCase().includes(query) ||
        unit.email?.toLowerCase().includes(query);
      const matchesAging = agingFilter === 'all' || Number(unit[agingFilter] || 0) > 0;
      return matchesQuery && matchesAging;
    });
  }, [agingFilter, search, units]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, agingFilter]);

  const totalPages = Math.max(Math.ceil(filteredUnits.length / PAGE_SIZE), 1);
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * PAGE_SIZE;
  const visibleUnits = filteredUnits.slice(pageStart, pageStart + PAGE_SIZE);
  const trendPrefix = summary.debt_change_percent >= 0 ? '+' : '';

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const openDetail = async (unit) => {
    if (!unit.owner_id) return;
    setDetailLoading(true);
    const data = await fetchOwnerDetail(unit.owner_id);
    if (data) setDetail(data);
    setDetailLoading(false);
  };

  const closeDetail = () => setDetail(null);

  const detailPeriods = detail?.apartments?.flatMap((item) => item.periods || []) || [];
  const detailTotals = detailPeriods.reduce(
    (acc, period) => ({
      capital: acc.capital + Number(period.capital_pendiente ?? period.esperado ?? 0),
      interest: acc.interest + Number(period.interes_mora || 0),
      fines: acc.fines + Number(period.multas || 0),
      total: acc.total + Number(period.saldo || 0),
    }),
    { capital: 0, interest: 0, fines: 0, total: 0 }
  );

  const exportCsv = () => {
    const headers = ['Unidad', 'Propietario', '30 dias', '60 dias', '90+ dias', 'Total adeudado'];
    const rows = filteredUnits.map((unit) => [
      unit.unit,
      unit.owner_name,
      unit['30_days'],
      unit['60_days'],
      unit['90_plus_days'],
      unit.total_debt,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'reporte-morosos.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.page}>
      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.statsGrid}>
        <StatCard
          tone="dangerCard"
          label="Total en mora"
          value={money(summary.total_debt)}
          subtext={`${trendPrefix}${Number(summary.debt_change_percent || 0).toFixed(0)}% vs mes anterior`}
          icon={<IconTrend />}
        />
        <StatCard
          tone="primaryCard"
          label="Unidades afectadas"
          value={`${summary.delinquent_units || 0} / ${summary.total_units || 0}`}
          subtext={`${Math.round(summary.affected_percent || 0)}% del total del edificio`}
          icon={<IconUsers />}
          progress={summary.affected_percent || 0}
        />
        <StatCard
          tone="neutralCard"
          label="Promedio de deuda"
          value={money(summary.average_debt)}
          subtext="Calculado sobre unidades activas"
          icon={<IconCalculator />}
        />
      </div>

      <div className={styles.contentGrid}>
        <section className={styles.tableCard}>
          <div className={styles.cardHeader}>
            <h1>Detalle de Unidades Morosas</h1>
            <div className={styles.toolbar}>
              <button className={styles.lightButton} onClick={() => setShowFilters((value) => !value)}>
                <IconFilter />
                Filtrar
              </button>
              <button className={styles.lightButton} onClick={exportCsv}>
                <IconDownload />
                Exportar
              </button>
            </div>
          </div>

          {showFilters && (
            <div className={styles.filters}>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar unidad o propietario"
              />
              <select value={agingFilter} onChange={(event) => setAgingFilter(event.target.value)}>
                <option value="all">Todas las deudas</option>
                <option value="30_days">30 dias</option>
                <option value="60_days">60 dias</option>
                <option value="90_plus_days">90+ dias</option>
              </select>
            </div>
          )}

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Unidad</th>
                  <th>30 Dias</th>
                  <th>60 Dias</th>
                  <th>90+ Dias</th>
                  <th>Total Adeudado</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {visibleUnits.map((unit) => (
                  <tr key={unit.apartment_id || unit.unit} className={unit['90_plus_days'] > 0 ? styles.criticalRow : ''}>
                    <td>
                      <strong>{unit.unit}</strong>
                      <span>{unit.owner_name}</span>
                    </td>
                    <td>{unit['30_days'] ? money(unit['30_days']) : '-'}</td>
                    <td className={unit['60_days'] ? styles.warningText : ''}>
                      {unit['60_days'] ? money(unit['60_days']) : '-'}
                    </td>
                    <td className={unit['90_plus_days'] ? styles.dangerText : ''}>
                      {unit['90_plus_days'] ? money(unit['90_plus_days']) : '-'}
                    </td>
                    <td>
                      <strong className={unit['90_plus_days'] > 0 ? styles.dangerText : ''}>
                        {money(unit.total_debt)}
                      </strong>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.detailButton}
                        onClick={() => openDetail(unit)}
                        disabled={detailLoading}
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && visibleUnits.length === 0 && (
                  <tr>
                    <td colSpan="6" className={styles.emptyState}>No hay unidades morosas con los filtros seleccionados</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <footer className={styles.tableFooter}>
            <span>
              Mostrando {filteredUnits.length ? pageStart + 1 : 0}-{Math.min(pageStart + visibleUnits.length, filteredUnits.length)} de {filteredUnits.length} unidades morosas
            </span>
            <div className={styles.pagination}>
              <small>Página {safeCurrentPage} de {totalPages}</small>
              <button
                type="button"
                aria-label="Anterior"
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
              >
                <IconChevron direction="left" />
              </button>
              <button
                type="button"
                aria-label="Siguiente"
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages))}
              >
                <IconChevron />
              </button>
            </div>
          </footer>
        </section>

        <aside className={styles.sidePanel}>
          <section className={styles.agingCard}>
            <h2>Antiguedad de Deuda</h2>
            <AgingBar label="30 Dias" percent={aging['30_days']?.percent} color="#6b93e9" />
            <AgingBar label="60 Dias" percent={aging['60_days']?.percent} color="#d97070" />
            <AgingBar label="90+ Dias" percent={aging['90_plus_days']?.percent} color="#c6191f" />
            <blockquote>
              "La morosidad de 90+ dias ha aumentado respecto a la semana pasada. Se recomienda iniciar procesos legales."
            </blockquote>
          </section>

        </aside>
      </div>

      {detail && (
        <div className={styles.modalBackdrop} role="presentation" onClick={closeDetail}>
          <section className={styles.detailModal} role="dialog" aria-modal="true" aria-label="Detalle de morosidad" onClick={(event) => event.stopPropagation()}>
            <header className={styles.detailHeader}>
              <div>
                <h2>{detail.full_name}</h2>
                <p>{detail.email || 'Sin correo registrado'}</p>
              </div>
              <button type="button" onClick={closeDetail} aria-label="Cerrar detalle">×</button>
            </header>

            <div className={styles.interestExplanation}>
              <div>
                <strong>Interés por mora</strong>
                <p>Se genera automáticamente desde el día siguiente al vencimiento, solo sobre capital vencido. La tasa BCE configurada es anual y se divide para 365; no se calcula interés sobre interés.</p>
              </div>
              <span>Aplica desde {LATE_INTEREST_START_PERIOD}</span>
            </div>

            <div className={styles.detailSummaryGrid}>
              <article>
                <span>Capital vencido</span>
                <strong>{moneyWithCents(detailTotals.capital)}</strong>
              </article>
              <article>
                <span>Interés por mora</span>
                <strong>{moneyWithCents(detailTotals.interest)}</strong>
              </article>
              <article>
                <span>Multas</span>
                <strong>{moneyWithCents(detailTotals.fines)}</strong>
              </article>
              <article>
                <span>Total pendiente</span>
                <strong>{moneyWithCents(detailTotals.total)}</strong>
              </article>
            </div>

            {detail.apartments?.map((item) => (
              <div className={styles.detailBlock} key={item.apartment.id}>
                <h3>Unidad {item.apartment.code}</h3>
                <div className={styles.detailTableWrap}>
                  <table className={styles.detailTable}>
                    <thead>
                      <tr>
                        <th>Periodo</th>
                        <th>Capital vencido</th>
                        <th>Interés por mora</th>
                        <th>Situación mora</th>
                        <th>Multas</th>
                        <th>Pagado</th>
                        <th>Total pendiente</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {item.periods.map((period) => (
                        <tr key={`${item.apartment.id}-${period.period}`}>
                          <td>{period.period}</td>
                          <td>{moneyWithCents(period.capital_pendiente ?? period.esperado)}</td>
                          <td>{interestCell(period)}</td>
                          <td>{interestStatus(period)}</td>
                          <td>{moneyWithCents(period.multas)}</td>
                          <td>{moneyWithCents(period.pagado)}</td>
                          <td><strong>{moneyWithCents(period.saldo)}</strong></td>
                          <td>{period.status === 'OVERDUE' ? 'Vencido' : 'Al día'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </section>
        </div>
      )}
    </div>
  );
}

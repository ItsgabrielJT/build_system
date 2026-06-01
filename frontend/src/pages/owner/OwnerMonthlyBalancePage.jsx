import { useState } from 'react';
import MonthlyBalanceCards from '../../components/MonthlyBalanceCards/MonthlyBalanceCards';
import MonthlyBalanceChart from '../../components/MonthlyBalanceChart/MonthlyBalanceChart';
import { useMonthlyBalance } from '../../hooks/useMonthlyBalance';
import styles from './OwnerMonthlyBalancePage.module.css';

function getCurrentMonthPeriod() {
  return new Date().toISOString().slice(0, 7);
}

export default function OwnerMonthlyBalancePage() {
  const [period, setPeriod] = useState(getCurrentMonthPeriod());
  const { data, loading, error } = useMonthlyBalance('PROPIETARIO', period);

  return (
    <div className={styles.page}>
      <section className={styles.header}>
        <div>
          <div className={styles.badge}>Solo lectura</div>
          <h1>Balance mensual del edificio</h1>
          <p>Consulta consolidada de ingresos, gastos y balance neto del mes.</p>
        </div>

        <label className={styles.monthField}>
          <span>Mes consultado</span>
          <input
            type="month"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            aria-label="Mes consultado"
          />
        </label>
      </section>

      {error ? <div className={styles.errorBanner}>{error}</div> : null}

      <MonthlyBalanceCards summary={data} loading={loading} />
      <MonthlyBalanceChart summary={data} loading={loading} />
    </div>
  );
}
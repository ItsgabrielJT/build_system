import styles from './MonthlyBalanceCards.module.css';

function formatCurrency(value) {
  return `$${Number(value || 0).toLocaleString('es-EC', {
    maximumFractionDigits: 0,
  })}`;
}

function formatVariation(value, compLabel) {
  if (value === null || value === undefined) return 'Sin base comparativa';
  const sign = Number(value) > 0 ? '+' : '';
  return `${sign}${Number(value).toFixed(1)}% vs ${compLabel}`;
}

export default function MonthlyBalanceCards({ summary, loading = false, periodLabel = 'del mes' }) {
  const compLabel = periodLabel === 'del semestre' ? 'semestre anterior' : periodLabel === 'del año' ? 'año anterior' : 'mes anterior';
  const balance = summary || {};
  const variation = balance.previous_period_variation || {};

  if (loading) {
    return (
      <div className={styles.grid}>
        <article className={styles.card}><span>Cargando balance mensual...</span></article>
      </div>
    );
  }

  const items = [
    {
      label: `Ingresos ${periodLabel}`,
      value: balance.income_total,
      variation: variation.income_pct,
      tone: 'income',
    },
    {
      label: `Gastos ${periodLabel}`,
      value: balance.expense_total,
      variation: variation.expense_pct,
      tone: 'expense',
    },
    {
      label: 'Balance neto',
      value: balance.net_balance,
      variation: variation.net_balance_pct,
      tone: 'net',
    },
  ];

  return (
    <div className={styles.grid}>
      {items.map((item) => (
        <article key={item.label} className={`${styles.card} ${styles[item.tone]}`}>
          <span>{item.label}</span>
          <strong>{formatCurrency(item.value)}</strong>
          <small>{formatVariation(item.variation, compLabel)}</small>
        </article>
      ))}
    </div>
  );
}
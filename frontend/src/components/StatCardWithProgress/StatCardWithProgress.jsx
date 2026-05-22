import styles from './StatCardWithProgress.module.css';

export default function StatCardWithProgress({ label, amount, budget, percentage, overBudgetAmount }) {
  const isOver = percentage > 100;
  const isWarning = percentage >= 80 && percentage <= 100;
  const barPct = Math.min(percentage, 100);
  const barClass = isOver ? styles.barDanger : isWarning ? styles.barWarning : styles.barNormal;

  return (
    <div className={`${styles.card} ${isOver ? styles.cardOver : ''}`}>
      {isOver && <span className={styles.overBadge}>Presupuesto Excedido</span>}
      <p className={styles.label}>{label}</p>
      <p className={styles.amount}>${Number(amount).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
      <p className={styles.budget}>/ ${Number(budget).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} presupuesto</p>
      <div className={styles.barTrack}>
        <div className={`${styles.barFill} ${barClass}`} style={{ width: `${barPct}%` }} />
      </div>
      {isOver ? (
        <p className={styles.overText}>+${Number(overBudgetAmount).toLocaleString('es-MX', { minimumFractionDigits: 2 })} sobre el presupuesto</p>
      ) : (
        <p className={styles.pctText}>{Number(percentage).toFixed(0)}% utilizado</p>
      )}
    </div>
  );
}

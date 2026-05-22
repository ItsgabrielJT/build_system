import styles from './RecentExpensesList.module.css';

const CATEGORY_ICONS = {
  Mantenimiento: '🔧',
  Servicios: '💧',
  Seguridad: '🔒',
  Limpieza: '🧹',
  Administración: '📋',
  Otros: '📌',
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
}

export default function RecentExpensesList({ expenses, loading }) {
  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>Recent Expenses</span>
        <span className={styles.viewAll}>View All</span>
      </div>
      {loading ? (
        <p className={styles.empty}>Loading...</p>
      ) : !expenses || expenses.length === 0 ? (
        <p className={styles.empty}>No recent expenses</p>
      ) : (
        <ul className={styles.list}>
          {expenses.map((exp) => (
            <li key={exp.id} className={styles.item}>
              <div className={styles.iconWrap}>
                <span className={styles.icon}>{CATEGORY_ICONS[exp.category] || '📌'}</span>
              </div>
              <div className={styles.info}>
                <p className={styles.concept}>{exp.concept}</p>
                <p className={styles.provider}>{exp.provider || '—'}</p>
              </div>
              <div className={styles.right}>
                <p className={styles.amount}>-${Number(exp.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                <p className={styles.date}>{formatDate(exp.date)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

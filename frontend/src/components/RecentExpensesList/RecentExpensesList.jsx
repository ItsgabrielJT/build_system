import { getExpenseCategoryIcon } from '../../constants/expenseCategories';
import styles from './RecentExpensesList.module.css';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es', { day: '2-digit', month: 'short' }).toUpperCase();
}

export default function RecentExpensesList({ expenses, loading, onViewAll }) {
  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>Gastos Recientes</span>
        <span className={styles.viewAll} onClick={onViewAll}>Ver Todo</span>
      </div>
      {loading ? (
        <p className={styles.empty}>Cargando...</p>
      ) : !expenses || expenses.length === 0 ? (
        <p className={styles.empty}>No hay gastos recientes</p>
      ) : (
        <ul className={styles.list}>
          {expenses.map((exp) => (
            <li key={exp.id} className={styles.item}>
              <div className={styles.iconWrap}>
                <span className={styles.icon}>{getExpenseCategoryIcon(exp.category)}</span>
              </div>
              <div className={styles.info}>
                <p className={styles.concept}>{exp.concept}</p>
                <p className={styles.provider}>{exp.provider || '—'}</p>
              </div>
              <div className={styles.right}>
                <p className={styles.amount}>-${Number(exp.amount).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                <p className={styles.date}>{formatDate(exp.date)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

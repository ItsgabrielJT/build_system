import styles from './StatCard.module.css';

export default function StatCard({ label, value, icon, color }) {
  const colorClass = color === 'success'
    ? styles.success
    : color === 'danger'
    ? styles.danger
    : color === 'warning'
    ? styles.warning
    : styles.primary;

  return (
    <div className={`${styles.card} ${colorClass}`}>
      {icon && <span className={styles.icon}>{icon}</span>}
      <div className={styles.body}>
        <p className={styles.label}>{label}</p>
        <p className={styles.value}>{value}</p>
      </div>
    </div>
  );
}

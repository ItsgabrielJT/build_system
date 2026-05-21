import styles from './DelinquencyBadge.module.css';

const STATUS_MAP = {
  OVERDUE: { label: 'EN MORA', className: 'danger' },
  CURRENT: { label: 'AL DÍA', className: 'success' },
  VENCIDO: { label: 'VENCIDO', className: 'danger' },
  AL_DIA: { label: 'AL DÍA', className: 'success' },
};

export default function DelinquencyBadge({ status }) {
  const config = STATUS_MAP[status] || { label: status, className: 'default' };
  return (
    <span className={`${styles.badge} ${styles[config.className]}`}>{config.label}</span>
  );
}

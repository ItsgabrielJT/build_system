import styles from './PaymentStatusBadge.module.css';

const STATUS_MAP = {
  PENDIENTE_APROBACION: { label: 'Pendiente', className: 'warning' },
  APROBADO: { label: 'Aprobado', className: 'success' },
  RECHAZADO: { label: 'Rechazado', className: 'danger' },
  ANULADO: { label: 'Anulado', className: 'default' },
  REGISTRADO: { label: 'Pagado', className: 'success' },
};

export default function PaymentStatusBadge({ status }) {
  const config = STATUS_MAP[status] || { label: status, className: 'default' };
  return (
    <span className={`${styles.badge} ${styles[config.className]}`}>{config.label}</span>
  );
}

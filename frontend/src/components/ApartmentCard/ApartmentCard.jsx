import styles from './ApartmentCard.module.css';

export default function ApartmentCard({ apartment, onClick }) {
  const getStatusClass = (status) => {
    switch (status) {
      case 'OCUPADO':
        return styles.occupied;
      case 'VACANTE':
        return styles.vacant;
      case 'MANTENIMIENTO':
        return styles.maintenance;
      default:
        return '';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'OCUPADO': return 'Ocupado';
      case 'VACANTE': return 'Vacante';
      case 'MANTENIMIENTO': return 'Mantenimiento';
      default: return status;
    }
  };

  const getLocationLabel = () => {
    const parts = [];
    if (apartment.floor) parts.push(`Piso ${apartment.floor}`);
    if (apartment.tower) parts.push(`Torre ${apartment.tower}`);
    return parts.join(', ');
  };

  return (
    <div className={styles.apartmentCard} onClick={onClick}>
      <div className={styles.cardContent}>
        <div className={styles.cardHeader}>
          <div className={styles.codeBlock}>
            <span className={styles.codeLabel}>Unidad</span>
            <h3 className={styles.cardTitle}>{apartment.code}</h3>
          </div>
          <span className={`${styles.statusBadge} ${getStatusClass(apartment.status)}`}>
            {getStatusLabel(apartment.status)}
          </span>
        </div>

        <div className={styles.cardMeta}>
          <div className={styles.metaItem}>
            <div className={styles.metaLabel}>Ubicación</div>
            <div className={styles.metaValue}>{getLocationLabel() || '—'}</div>
          </div>
          <div className={styles.metaItem}>
            <div className={styles.metaLabel}>Propietario</div>
            <div className={styles.metaValue}>{apartment.owner_name || '—'}</div>
          </div>
        </div>

        <div className={styles.cardFooter}>
          <span>Alícuota</span>
          <strong>{Number(apartment.allocated_quota_percent || 0).toFixed(2)}%</strong>
        </div>
      </div>
    </div>
  );
}

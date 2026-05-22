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
      {/* Imagen */}
      <div className={styles.imageContainer}>
        {apartment.image_url ? (
          <img src={apartment.image_url} alt={apartment.code} />
        ) : (
          <span>Sin imagen</span>
        )}
      </div>

      {/* Contenido */}
      <div className={styles.cardContent}>
        {/* Encabezado con código y estado */}
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>{apartment.code}</h3>
          <span className={`${styles.statusBadge} ${getStatusClass(apartment.status)}`}>
            {getStatusLabel(apartment.status)}
          </span>
        </div>

        {/* Metadatos */}
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
      </div>
    </div>
  );
}

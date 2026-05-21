/**
 * ApartmentCard Component
 * 
 * Tarjeta individual que muestra:
 * - Código de unidad
 * - Estado de ocupación (con color)
 * - Ubicación (Piso, Torre)
 * - Área (m²)
 * - Alícuota asignada (%)
 * - Foto/Imagen de referencia
 */

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
            {apartment.status}
          </span>
        </div>

        {/* Metadatos */}
        <div className={styles.cardMeta}>
          <div className={styles.metaItem}>
            <div className={styles.metaLabel}>Ubicación</div>
            <div className={styles.metaValue}>{getLocationLabel()}</div>
          </div>
          <div className={styles.metaItem}>
            <div className={styles.metaLabel}>Propietario</div>
            <div className={styles.metaValue}>{apartment.owner_name || '—'}</div>
          </div>
        </div>

        {/* Pie de la tarjeta */}
        <div className={styles.cardFooter}>
          <div className={styles.area}>
            Área: <span className={styles.areaValue}>{apartment.area_sqm}m²</span>
          </div>
          <div className={styles.aliquot}>
            Alícuota: <span className={styles.aliquotValue}>{apartment.allocated_quota_percent?.toFixed(2)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * DepartmentStats Component
 * 
 * Muestra 4 tarjetas de resumen:
 * - Total Ocupados (con porcentaje de ocupación)
 * - Total Vacantes (disponibles ahora)
 * - En Mantenimiento (en revisión)
 * - Alícuota Total (% distribuido)
 */

import styles from './DepartmentStats.module.css';

export default function DepartmentStats({ statistics, loading }) {
  if (loading || !statistics) {
    return (
      <div className={styles.statsGrid}>
        <div className={styles.statCard}><p>Cargando...</p></div>
        <div className={styles.statCard}><p>Cargando...</p></div>
        <div className={styles.statCard}><p>Cargando...</p></div>
        <div className={styles.statCard}><p>Cargando...</p></div>
      </div>
    );
  }

  return (
    <div className={styles.statsGrid}>
      <div className={`${styles.statCard} ${styles.occupied}`}>
        <span className={styles.statIcon}>O</span>
        <div>
          <h3>Ocupados</h3>
          <p className={styles.statValue}>{statistics.occupied}</p>
          <p className={styles.statSubtext}>{statistics.occupancy_rate_percent?.toFixed(1)}% ocupación</p>
        </div>
      </div>

      <div className={`${styles.statCard} ${styles.vacant}`}>
        <span className={styles.statIcon}>V</span>
        <div>
          <h3>Vacantes</h3>
          <p className={styles.statValue}>{statistics.vacant}</p>
          <p className={styles.statSubtext}>Disponibles ahora</p>
        </div>
      </div>

      <div className={`${styles.statCard} ${styles.maintenance}`}>
        <span className={styles.statIcon}>M</span>
        <div>
          <h3>Mantenimiento</h3>
          <p className={styles.statValue}>{statistics.maintenance}</p>
          <p className={styles.statSubtext}>En revisión</p>
        </div>
      </div>

      <div className={`${styles.statCard} ${styles.total}`}>
        <span className={styles.statIcon}>T</span>
        <div>
          <h3>Total de Unidades</h3>
          <p className={styles.statValue}>{statistics.total}</p>
          <p className={styles.statSubtext}>{statistics.allocated_quota_percent?.toFixed(1)}% alícuota</p>
        </div>
      </div>
    </div>
  );
}

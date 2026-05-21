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
      {/* Ocupados */}
      <div className={`${styles.statCard} ${styles.occupied}`}>
        <h3>Ocupados</h3>
        <p className={styles.statValue}>{statistics.occupied}</p>
        <p className={styles.statSubtext}>{statistics.occupancy_rate_percent?.toFixed(1)}% ocupación</p>
      </div>

      {/* Vacantes */}
      <div className={`${styles.statCard} ${styles.vacant}`}>
        <h3>Vacantes</h3>
        <p className={styles.statValue}>{statistics.vacant}</p>
        <p className={styles.statSubtext}>Disponibles ahora</p>
      </div>

      {/* Mantenimiento */}
      <div className={`${styles.statCard} ${styles.maintenance}`}>
        <h3>Mantenimiento</h3>
        <p className={styles.statValue}>{statistics.maintenance}</p>
        <p className={styles.statSubtext}>En revisión</p>
      </div>

      {/* Total de Unidades */}
      <div className={`${styles.statCard} ${styles.total}`}>
        <h3>Total de Unidades</h3>
        <p className={styles.statValue}>{statistics.total}</p>
        <p className={styles.statSubtext}>{statistics.allocated_quota_percent?.toFixed(1)}% alícuota</p>
      </div>
    </div>
  );
}

import { useEffect } from 'react';
import { useApartments } from '../../hooks/useApartments';
import DelinquencyBadge from '../../components/DelinquencyBadge/DelinquencyBadge';
import styles from './OwnerApartmentsPage.module.css';

export default function OwnerApartmentsPage() {
  const { apartments, loading, error, fetchApartments } = useApartments();

  useEffect(() => {
    fetchApartments();
  }, [fetchApartments]);

  if (loading) return <p className={styles.loading}>Cargando departamentos...</p>;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Mis Departamentos</h1>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      {!apartments.length ? (
        <p className={styles.empty}>No tienes departamentos asignados.</p>
      ) : (
        <div className={styles.grid}>
          {apartments.map((apt) => (
            <div key={apt.id} className={styles.card}>
              <div className={styles.cardTop}>
                <span className={styles.code}>Depto {apt.code}</span>
                <DelinquencyBadge status={apt.delinquency_status || 'CURRENT'} />
              </div>
              <div className={styles.cardBody}>
                {apt.floor != null && (
                  <div className={styles.detail}>
                    <span className={styles.detailLabel}>Piso:</span>
                    <span className={styles.detailValue}>{apt.floor}</span>
                  </div>
                )}
                {apt.tower && (
                  <div className={styles.detail}>
                    <span className={styles.detailLabel}>Torre:</span>
                    <span className={styles.detailValue}>{apt.tower}</span>
                  </div>
                )}
                {apt.current_balance != null && (
                  <div className={styles.detail}>
                    <span className={styles.detailLabel}>Saldo actual:</span>
                    <span
                      className={styles.detailValue}
                      style={{ color: apt.current_balance > 0 ? 'var(--color-danger)' : 'var(--color-success)', fontWeight: 700 }}
                    >
                      ${Number(apt.current_balance).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

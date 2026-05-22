/**
 * OwnerDetailModal Component
 * 
 * Modal con detalles completos del propietario:
 * - Información personal
 * - Listado de unidades asignadas
 * - Historial de ingresos/egresos (últimas 3 transacciones)
 * - Balance consolidado
 */

import styles from './OwnerDetailModal.module.css';

export default function OwnerDetailModal({ owner, onClose }) {
  if (!owner) return null;

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatBalance = (balance) => {
    const formatted = Math.abs(balance).toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `$${formatted}`;
  };

  const handleDownloadPDF = () => {
    // TODO: Implementar descarga de PDF
    alert('Función de descarga de PDF será implementada próximamente');
  };

  return (
    <div className={styles.modal} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Detalles del Propietario</h2>
          <button className={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Body */}
        <div className={styles.modalBody}>
          {/* Información Personal */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
              <span className={styles.sectionIcon}>👤</span>
              Información Personal
            </h3>
            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Nombre Completo</span>
                <span className={styles.infoValue}>{owner.full_name}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Documento</span>
                <span className={styles.infoValue}>{owner.document_id || '—'}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Email</span>
                <span className={styles.infoValue}>{owner.email || '—'}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Teléfono</span>
                <span className={styles.infoValue}>{owner.phone || '—'}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Fecha de Ingreso</span>
                <span className={styles.infoValue}>{formatDate(owner.ingress_date)}</span>
              </div>
            </div>
          </div>

          {/* Unidades Asignadas */}
          {owner.units && owner.units.length > 0 && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>
                <span className={styles.sectionIcon}>🏠</span>
                Unidades Asignadas ({owner.units.length})
              </h3>
              <div className={styles.unitsList}>
                {owner.units.map((unit) => (
                  <div key={unit.id} className={styles.unitItem}>
                    <div>
                      <div className={styles.unitCode}>{unit.code}</div>
                      <div className={styles.unitLocation}>
                        {unit.tower && `Torre ${unit.tower}`}
                        {unit.tower && unit.floor && ' - '}
                        {unit.floor && `Piso ${unit.floor}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Balance Consolidado */}
          <div className={styles.section}>
            <div
              className={`${styles.balanceSection} ${
                owner.balance < 0 ? styles.balanceValue : ''
              }`}
              style={{
                backgroundColor: owner.balance < 0 ? '#fef5f5' : '#f0f9f6',
                borderLeftColor: owner.balance < 0 ? '#e74c3c' : '#27ae60',
              }}
            >
              <div className={styles.balanceLabel}>Balance Consolidado</div>
              <div
                className={`${styles.balanceValue} ${owner.balance < 0 ? styles.negative : ''}`}
              >
                {owner.balance < 0 ? '-' : ''}
                {formatBalance(owner.balance)}
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          <button className={styles.buttonSecondary} onClick={onClose}>
            Cerrar
          </button>
          <button className={styles.buttonPrimary} onClick={handleDownloadPDF}>
            📄 Descargar Estado de Cuenta
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useApartments } from '../../hooks/useApartments';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../context/NotificationContext';
import DelinquencyBadge from '../../components/DelinquencyBadge/DelinquencyBadge';
import DownloadIcon from '../../components/icons/DownloadIcon';
import { exportAccountStatement, exportExpenseCertificate } from '../../services/accountStatementService';
import styles from './OwnerApartmentsPage.module.css';

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function OwnerApartmentsPage() {
  const { apartments, loading, error, fetchApartments } = useApartments();
  const { token } = useAuth();
  const { success, error: toastError } = useNotification();
  const [downloadingCertificate, setDownloadingCertificate] = useState(false);
  const [downloadingStatement, setDownloadingStatement] = useState(false);

  useEffect(() => {
    fetchApartments();
  }, [fetchApartments]);

  const handleDownloadCertificate = async () => {
    setDownloadingCertificate(true);
    try {
      const blob = await exportExpenseCertificate(token);
      triggerDownload(blob, 'certificado-expensas.pdf');
      success('Certificado de expensas descargado');
    } catch (err) {
      toastError(err.response?.data?.detail || 'No se pudo descargar el certificado.');
    } finally {
      setDownloadingCertificate(false);
    }
  };

  const handleDownloadStatement = async () => {
    setDownloadingStatement(true);
    try {
      const blob = await exportAccountStatement(token, 'pdf');
      triggerDownload(blob, 'estado-cuenta.pdf');
      success('Estado de cuenta descargado');
    } catch (err) {
      toastError(err.response?.data?.detail || 'No se pudo descargar el estado de cuenta.');
    } finally {
      setDownloadingStatement(false);
    }
  };

  if (loading) return <p className={styles.loading}>Cargando departamentos...</p>;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Mis Departamentos</h1>
        <div className={styles.actions}>
          <button
            className={styles.pdfButton}
            type="button"
            onClick={handleDownloadStatement}
            disabled={downloadingStatement || !apartments.length}
          >
            <DownloadIcon />
            {downloadingStatement ? 'Generando...' : 'Estado de cuenta'}
          </button>
          <button
            className={styles.pdfButton}
            type="button"
            onClick={handleDownloadCertificate}
            disabled={downloadingCertificate || !apartments.length}
          >
            <DownloadIcon />
            {downloadingCertificate ? 'Generando...' : 'Certificado de expensas'}
          </button>
        </div>
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

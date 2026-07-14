import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { getBuildingConfig } from '../../services/buildingService';
import styles from './OwnerHelpPage.module.css';

export default function OwnerHelpPage() {
  const { token } = useAuth();
  const [building, setBuilding] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadBuildingConfig() {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const config = await getBuildingConfig(token);
        if (!cancelled) setBuilding(config);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.detail || 'No se pudo cargar la información de contacto.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadBuildingConfig();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const supportEmail = building?.email?.trim();
  const supportPhone = building?.phone?.trim();
  const buildingName = building?.name?.trim() || 'Administración';
  const buildingAddress = building?.address?.trim();

  if (loading) {
    return <div className={styles.loading}>Cargando centro de ayuda...</div>;
  }

  return (
    <div className={styles.page}>
      <header>
        <h1 className={styles.title}>Centro de ayuda</h1>
        <p className={styles.subtitle}>Consulte canales de soporte, preguntas frecuentes y asistencia administrativa.</p>
      </header>
      
      <div className={styles.grid}>
        <section className={styles.card}>
          <h2>Soporte / contacto</h2>
          {error ? <div className={styles.errorBanner}>{error}</div> : null}
          <div className={styles.infoRow}>
            <span className={styles.icon}>✉</span>
            <div>
              <h3>Correo de Soporte</h3>
              <p>
                {supportEmail ? (
                  <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
                ) : (
                  'Correo no configurado'
                )}
              </p>
              <span className={styles.tag}>{buildingName}</span>
            </div>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.icon}>📞</span>
            <div>
              <h3>Teléfono</h3>
              <p>{supportPhone || 'Teléfono no configurado'}</p>
              <span className={styles.tag}>Soporte administrativo</span>
            </div>
          </div>
          {buildingAddress ? (
            <div className={styles.infoRow}>
              <span className={styles.icon}>⌂</span>
              <div>
                <h3>Dirección</h3>
                <p>{buildingAddress}</p>
                <span className={styles.tag}>Ubicación del edificio</span>
              </div>
            </div>
          ) : null}
        </section>

        <section className={styles.card}>
          <h2>Preguntas frecuentes</h2>
          <div className={styles.faqList}>
            <div className={styles.faqItem}>
              <strong>¿Cómo registro un pago?</strong>
              <p>Diríjase al módulo de Pagos, haga clic en Registrar Pago y cargue su comprobante de transferencia.</p>
            </div>
            <div className={styles.faqItem}>
              <strong>¿Cuándo vencen mis expensas?</strong>
              <p>Las expensas vencen usualmente los primeros 5 o 10 días de cada mes. Verifique las novedades en Avisos Importantes.</p>
            </div>
          </div>
        </section>

        <section className={styles.card}>
          <h2>Solicitudes</h2>
          <div className={styles.faqList}>
            <div className={styles.faqItem}>
              <strong>Actualización de datos</strong>
              <p>Solicite cambios de teléfono, correo o datos del ocupante desde el módulo Mi perfil.</p>
            </div>
            <div className={styles.faqItem}>
              <strong>Emergencias administrativas</strong>
              <p>Comuníquese directamente con administración para incidentes de seguridad, mantenimiento o accesos.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

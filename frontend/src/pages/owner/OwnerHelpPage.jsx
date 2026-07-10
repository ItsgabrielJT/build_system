import React from 'react';
import styles from './OwnerHelpPage.module.css';

export default function OwnerHelpPage() {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Centro de Ayuda y Soporte</h1>
      <p className={styles.subtitle}>¿Necesita ayuda? Póngase en contacto con la administración del edificio.</p>
      
      <div className={styles.grid}>
        <div className={styles.card}>
          <h2>Contacto Directo</h2>
          <div className={styles.infoRow}>
            <span className={styles.icon}>✉</span>
            <div>
              <h3>Correo de Soporte</h3>
              <p><a href="mailto:soporte@torresnetanya.com">soporte@torresnetanya.com</a></p>
              <span className={styles.tag}>Soporte administrativo</span>
            </div>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.icon}>📞</span>
            <div>
              <h3>Teléfono</h3>
              <p>+593 99 295 3596</p>
              <span className={styles.tag}>Lunes a viernes: 08:00 - 17:00</span>
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <h2>Preguntas Frecuentes</h2>
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
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import styles from './OwnerCamerasPage.module.css';

export default function OwnerCamerasPage() {
  const mockCameras = [
    { id: 1, name: 'Entrada Principal (Lobby)', status: 'Activa' },
    { id: 2, name: 'Estacionamiento Subterráneo', status: 'Activa' },
    { id: 3, name: 'Áreas Comunes / Jardines', status: 'Activa' },
  ];

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Cámaras de Seguridad</h1>
      <p className={styles.subtitle}>Visualice el estado en tiempo real de las cámaras del edificio.</p>
      
      <div className={styles.grid}>
        {mockCameras.map((camera) => (
          <div key={camera.id} className={styles.card}>
            <div className={styles.videoPlaceholder}>
              <div className={styles.recBadge}>
                <span className={styles.recDot}></span> REC
              </div>
              <span className={styles.cameraNameBadge}>{camera.name}</span>
              <div className={styles.noiseOverlay}></div>
            </div>
            <div className={styles.cardFooter}>
              <span className={styles.statusBadge}>{camera.status}</span>
              <span className={styles.timestamp}>{new Date().toLocaleTimeString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

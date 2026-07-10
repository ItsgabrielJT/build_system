import styles from './OwnerCamerasPage.module.css';

export default function OwnerCamerasPage() {
  const cameras = [
    {
      id: 1,
      name: 'Cámara 1 - Ingreso Principal',
      image: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=80',
    },
    {
      id: 2,
      name: 'Cámara 2 - Parqueadero',
      image: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1200&q=80',
    },
    {
      id: 3,
      name: 'Cámara 3 - Lobby Piso 2',
      image: 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=80',
    },
    {
      id: 4,
      name: 'Cámara 4 - Terraza',
      image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
    },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Cámaras</h1>
          <p className={styles.subtitle}>Visualiza en tiempo real las cámaras de seguridad del edificio.</p>
        </div>
      </header>

      <section className={styles.viewerCard}>
        <div className={styles.viewerToolbar}>
          <div className={styles.liveTitle}>
            <strong>Visualización en vivo</strong>
            <span><i /> En línea</span>
          </div>
          <div className={styles.controls}>
            <button className={styles.controlActive} type="button">Cuadrícula</button>
            <button type="button">Una cámara</button>
            <button className={styles.iconButton} type="button" aria-label="Expandir">↗</button>
          </div>
        </div>

        <div className={styles.grid}>
          {cameras.map((camera) => (
            <article key={camera.id} className={styles.camera}>
              <img src={camera.image} alt={camera.name} />
              <div className={styles.cameraName}><span /> {camera.name}</div>
              <div className={styles.liveBadge}><span /> EN VIVO</div>
              <button className={styles.expandButton} type="button" aria-label={`Expandir ${camera.name}`}>↗</button>
            </article>
          ))}
        </div>

        <footer className={styles.statusBar}>
          <div>
            <strong>Estado del sistema</strong>
            <span>Todas las cámaras operativas</span>
          </div>
          <div>
            <strong>Última actualización</strong>
            <span>08/07/2026 11:24:36</span>
          </div>
          <div>
            <strong>Grabación</strong>
            <span>24/7 activada</span>
          </div>
          <button type="button">Ver historial de grabaciones</button>
        </footer>
      </section>
    </div>
  );
}

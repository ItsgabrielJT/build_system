import styles from './OwnerCamerasPage.module.css';
import accesoPeatonal from '../../assets/camaras/acceso_peatonal.jpeg';
import accesoVehicular from '../../assets/camaras/acceso_vehicular.jpeg';
import parqueaderoInterior from '../../assets/camaras/parqueadero_interior.jpeg';
import plantaBaja from '../../assets/camaras/planta_baja.jpeg';

export default function OwnerCamerasPage() {
  const cameras = [
    {
      id: 1,
      name: 'Cámara 1 - Planta Baja',
      image: accesoPeatonal,
    },
    {
      id: 2,
      name: 'Cámara 2 - Acceso Vehicular',
      image: parqueaderoInterior,
    },
    {
      id: 3,
      name: 'Cámara 3 - Parqueadero Interior',
      image: plantaBaja,
    },
    {
      id: 4,
      name: 'Cámara 4 - Acceso Peatonal',
      image: accesoVehicular,
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
              <img className={styles.cameraImage} src={camera.image} alt={`Vista previa de ${camera.name}`} />
              <div className={styles.videoOverlay} aria-hidden="true" />
              <div className={styles.liveBadge}><span /> En vivo</div>
              <div className={styles.cameraName}><span /> {camera.name}</div>
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

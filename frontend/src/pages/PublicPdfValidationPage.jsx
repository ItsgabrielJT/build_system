import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getPublicBuildingLogoUrl, validatePdfDocument } from '../services/pdfValidationService';
import styles from './PublicPdfValidationPage.module.css';

function formatGeneratedAt(value) {
  if (!value) return 'No disponible';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-EC', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(date);
}

function getInitials(value) {
  const words = String(value || 'Edificio')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'ED';
}

const SystemLogo = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 9.5 12 3l9 6.5v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5v-10Z" />
    <path d="M8 21v-8h8v8" />
    <path d="M9 8h6" />
  </svg>
);

export default function PublicPdfValidationPage() {
  const { token } = useParams();
  const [status, setStatus] = useState('loading');
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    setStatus('loading');

    validatePdfDocument(token)
      .then((result) => {
        if (!alive) return;
        setData(result);
        setStatus(result?.valid ? 'valid' : 'invalid');
      })
      .catch(() => {
        if (!alive) return;
        setData({ valid: false });
        setStatus('invalid');
      });

    return () => {
      alive = false;
    };
  }, [token]);

  const rows = useMemo(() => {
    if (!data?.valid) return [];
    return [
      ['Archivo descargado', data.file_name || 'Documento PDF'],
      ['Generado por', data.generated_by || 'Usuario del sistema'],
      ['Rol', data.generated_role || 'No disponible'],
      ['Fecha de generado', formatGeneratedAt(data.generated_at)],
      ['Edificio', data.building_name || 'No disponible'],
      ['Código de documento', data.document_id || 'No disponible'],
    ];
  }, [data]);

  const logoUrl = data?.building_id ? getPublicBuildingLogoUrl(data.building_id) : null;
  const buildingName = data?.building_name || 'Edificio';

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <div className={styles.hero}>
          <div className={styles.brandStack}>
            <div className={styles.logoCluster} aria-label="Logos de validación">
              <div className={styles.systemMark}>
                <SystemLogo />
              </div>
              <div className={styles.logoConnector} />
              <div className={styles.buildingMark}>
                {logoUrl ? (
                  <img src={logoUrl} alt={`Logo de ${buildingName}`} />
                ) : (
                  <span>{getInitials(buildingName)}</span>
                )}
              </div>
            </div>
            <div>
              <p className={styles.systemName}>HabitaUIO</p>
              <p className={styles.buildingName}>{buildingName}</p>
            </div>
          </div>

          <div className={styles.heroCopy}>
            <p className={styles.kicker}>Verificación pública de PDF</p>
            <h1>Consulta de autenticidad del documento</h1>
            <p>Escaneo validado desde el código QR generado por el sistema.</p>
          </div>
        </div>

        {status === 'loading' && (
          <div className={styles.stateBlock}>
            <div className={styles.spinner} aria-hidden="true" />
            <p className={styles.kicker}>Verificando documento</p>
            <h1>Validación en proceso</h1>
            <p className={styles.description}>Estamos comprobando la firma digital del QR escaneado.</p>
          </div>
        )}

        {status === 'valid' && (
          <>
            <div className={styles.statusHeader}>
              <div className={styles.statusSeal}>
                <span>OK</span>
              </div>
              <div>
                <p className={styles.kicker}>Documento verificado</p>
                <h1>El archivo pertenece al sistema</h1>
              </div>
              <span className={styles.validBadge}>Válido</span>
            </div>

            <div className={styles.summaryGrid}>
              <article>
                <span>Archivo</span>
                <strong>{data.file_name || 'Documento PDF'}</strong>
              </article>
              <article>
                <span>Generado por</span>
                <strong>{data.generated_by || 'Usuario del sistema'}</strong>
              </article>
              <article>
                <span>Fecha</span>
                <strong>{formatGeneratedAt(data.generated_at)}</strong>
              </article>
            </div>

            <dl className={styles.details}>
              {rows.map(([label, value]) => (
                <div className={styles.detailRow} key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>

            <p className={styles.notice}>
              La información se validó con la firma interna del QR emitido por el sistema. Si el enlace fue
              modificado, esta página no lo marcará como válido.
            </p>
          </>
        )}

        {status === 'invalid' && (
          <div className={styles.stateBlock}>
            <span className={styles.invalidBadge}>No válido</span>
            <p className={styles.kicker}>Validación fallida</p>
            <h1>No pudimos verificar este documento</h1>
            <p className={styles.description}>
              El enlace escaneado no coincide con una firma emitida por el sistema o fue modificado.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

import { useRef } from 'react';
import styles from './PaymentProofUpload.module.css';

const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const ACCEPTED_EXTENSIONS = '.pdf,.jpg,.jpeg,.png';
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB as in mockup

export default function PaymentProofUpload({ value, onChange, error }) {
  const inputRef = useRef(null);

  const processFile = (file) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      onChange(null, 'Tipo de archivo no soportado. Use PDF, JPG o PNG.');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      onChange(null, 'El archivo supera el límite de 10 MB.');
      return;
    }
    onChange(file, null);
  };

  const handleInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  return (
    <div className={styles.wrapper}>
      <div
        className={[
          styles.zone,
          error ? styles.zoneError : '',
          value ? styles.zoneReady : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      >
        <div className={styles.leftContainer}>
          <div className={styles.uploadIconContainer}>
            <svg
              className={styles.cloudIcon}
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"
              />
            </svg>
          </div>
          <div className={styles.textContainer}>
            {value ? (
              <span className={styles.fileName}>{value.name}</span>
            ) : (
              <>
                <span className={styles.titleText}>Arrastre y suelte su archivo aquí</span>
                <span className={styles.subText}>o seleccione un archivo desde su dispositivo</span>
              </>
            )}
          </div>
        </div>

        <div className={styles.actionsContainer}>
          {value ? (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={(e) => {
                e.stopPropagation();
                onChange(null, null);
              }}
            >
              Quitar
            </button>
          ) : (
            <span className={styles.selectBtn}>Seleccionar archivo</span>
          )}
        </div>
      </div>
      {error && <p className={styles.errorMsg}>{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        className={styles.input}
        onChange={handleInputChange}
      />
    </div>
  );
}


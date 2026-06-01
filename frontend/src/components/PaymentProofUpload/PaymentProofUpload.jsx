import { useRef } from 'react';
import styles from './PaymentProofUpload.module.css';

const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const ACCEPTED_EXTENSIONS = '.pdf,.jpg,.jpeg,.png';
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

/**
 * @param {{ value: File|null, onChange: (file: File|null, error: string|null) => void, error: string|null }} props
 */
export default function PaymentProofUpload({ value, onChange, error }) {
  const inputRef = useRef(null);

  const processFile = (file) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      onChange(null, 'Tipo de archivo no soportado. Use PDF, JPG o PNG.');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      onChange(null, 'El archivo supera el límite de 5 MB.');
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
        <span className={styles.icon}>{value ? '✅' : '📎'}</span>
        <span className={styles.text}>
          {value ? value.name : 'Adjuntar comprobante (PDF, JPG, PNG – máx. 5 MB)'}
        </span>
        {value && (
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
        )}
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

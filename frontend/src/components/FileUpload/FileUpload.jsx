import { useRef } from 'react';
import styles from './FileUpload.module.css';

export default function FileUpload({ onUpload, accept, maxSizeBytes, label }) {
  const inputRef = useRef(null);

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (maxSizeBytes && file.size > maxSizeBytes) {
      alert(`El archivo supera el tamaño máximo permitido (${Math.round(maxSizeBytes / 1024 / 1024)}MB)`);
      return;
    }

    onUpload(file);
    e.target.value = '';
  };

  return (
    <div
      className={styles.zone}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) onUpload(file);
      }}
    >
      <span className={styles.icon}>📎</span>
      <span className={styles.text}>{label || 'Adjuntar comprobante'}</span>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className={styles.input}
        onChange={handleChange}
      />
    </div>
  );
}

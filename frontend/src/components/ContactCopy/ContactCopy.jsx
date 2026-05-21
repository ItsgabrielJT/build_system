/**
 * ContactCopy Component
 * 
 * Componente para mostrar email o teléfono copiable.
 * Al hacer clic, copia al portapapeles.
 */

import { useState } from 'react';
import styles from './ContactCopy.module.css';

export default function ContactCopy({ type, value }) {
  const [copied, setCopied] = useState(false);

  if (!value) {
    return <span>—</span>;
  }

  const getIcon = () => {
    if (type === 'email') return '✉️';
    if (type === 'phone') return '📱';
    return '🔗';
  };

  const handleCopy = async (e) => {
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Error al copiar:', err);
    }
  };

  return (
    <button
      className={`${styles.contactCopy} ${styles.tooltip}`}
      onClick={handleCopy}
      data-tooltip={copied ? 'Copiado!' : 'Copiar al portapapeles'}
      type="button"
    >
      <span className={styles.icon}>{getIcon()}</span>
      <span className={styles.text}>{value}</span>
    </button>
  );
}

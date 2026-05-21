import styles from './ConfirmDialog.module.css';

export default function ConfirmDialog({ isOpen, message, confirmLabel, onConfirm, onCancel }) {
  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <button className={styles.btnCancel} onClick={onCancel} type="button">
            Cancelar
          </button>
          <button className={styles.btnConfirm} onClick={onConfirm} type="button">
            {confirmLabel || 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

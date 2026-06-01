import { useState } from 'react';
import styles from './PaymentReviewModal.module.css';

const formatCurrency = (value) =>
  `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value) => {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`));
};

/**
 * @param {{ payment: object|null, onApprove: (id: string) => Promise<void>, onReject: (id: string, reason: string) => Promise<void>, onClose: () => void }} props
 */
export default function PaymentReviewModal({ payment, onApprove, onReject, onClose }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (!payment) return null;

  const handleApprove = async () => {
    setSubmitting(true);
    setActionError(null);
    try {
      await onApprove(payment.id);
    } catch (err) {
      setActionError(err.response?.data?.detail || 'Error al aprobar el pago');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!reason.trim()) {
      setActionError('Debe indicar un motivo de rechazo.');
      return;
    }
    setSubmitting(true);
    setActionError(null);
    try {
      await onReject(payment.id, reason.trim());
    } catch (err) {
      setActionError(err.response?.data?.detail || 'Error al rechazar el pago');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelReject = () => {
    setRejecting(false);
    setReason('');
    setActionError(null);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Revisar Pago Pendiente</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <dl className={styles.grid}>
          <div className={styles.field}>
            <dt>Propietario</dt>
            <dd>{payment.owner_name || 'N/D'}</dd>
          </div>
          <div className={styles.field}>
            <dt>Departamento</dt>
            <dd>{payment.apartment_code || 'N/D'}</dd>
          </div>
          <div className={styles.field}>
            <dt>Período</dt>
            <dd>{payment.period}</dd>
          </div>
          <div className={styles.field}>
            <dt>Monto</dt>
            <dd>{formatCurrency(payment.amount)}</dd>
          </div>
          <div className={styles.field}>
            <dt>Fecha de pago</dt>
            <dd>{formatDate(payment.paid_at)}</dd>
          </div>
          <div className={styles.field}>
            <dt>Comprobante</dt>
            <dd>{payment.proof_file_name || 'Sin nombre'}</dd>
          </div>
          {payment.method && (
            <div className={styles.field}>
              <dt>Método</dt>
              <dd>{payment.method}</dd>
            </div>
          )}
          {payment.reference && (
            <div className={styles.field}>
              <dt>Referencia</dt>
              <dd>{payment.reference}</dd>
            </div>
          )}
        </dl>

        {rejecting && (
          <div className={styles.rejectForm}>
            <label className={styles.rejectLabel} htmlFor="reject-reason">
              Motivo de rechazo <span aria-hidden="true">*</span>
            </label>
            <textarea
              id="reject-reason"
              className={styles.textarea}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={4}
              placeholder="Describe el motivo del rechazo..."
            />
          </div>
        )}

        {actionError && <p className={styles.errorMsg}>{actionError}</p>}

        <div className={styles.actions}>
          {!rejecting ? (
            <>
              <button
                type="button"
                className={styles.btnApprove}
                onClick={handleApprove}
                disabled={submitting}
              >
                {submitting ? 'Procesando...' : 'Aprobar'}
              </button>
              <button
                type="button"
                className={styles.btnRejectOpen}
                onClick={() => setRejecting(true)}
                disabled={submitting}
              >
                Rechazar
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={styles.btnReject}
                onClick={handleReject}
                disabled={submitting}
              >
                {submitting ? 'Procesando...' : 'Confirmar rechazo'}
              </button>
              <button
                type="button"
                className={styles.btnCancel}
                onClick={handleCancelReject}
                disabled={submitting}
              >
                Cancelar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

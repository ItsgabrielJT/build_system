import { useState, useEffect, useRef } from 'react';
import styles from './EditExpenseModal.module.css';

const CATEGORIES = ['Servicios', 'Mantenimiento', 'Seguridad', 'Limpieza', 'Administración', 'Otros'];

export default function EditExpenseModal({ isOpen, onClose, expense, onSubmit }) {
  const [form, setForm] = useState({
    provider: '',
    category: '',
    date: '',
    amount: '',
    concept: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptError, setReceiptError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen && expense) {
      setForm({
        provider: expense.provider || '',
        category: expense.category || '',
        date: expense.date || '',
        amount: expense.amount ? String(expense.amount) : '',
        concept: expense.concept || '',
      });
      setReceiptFile(null);
      setReceiptError(null);
      setFormErrors({});
      setSubmitError(null);
    }
  }, [isOpen, expense]);

  if (!isOpen || !expense) return null;

  function validateForm(f) {
    const errors = {};
    if (!f.concept.trim()) errors.concept = 'El concepto es obligatorio';
    if (!f.date) errors.date = 'La fecha es obligatoria';
    if (!f.amount || isNaN(Number(f.amount)) || Number(f.amount) <= 0) {
      errors.amount = 'Ingrese un monto válido mayor a 0';
    }
    return errors;
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  const handleFileChange = (file) => {
    if (!file) {
      setReceiptFile(null);
      setReceiptError(null);
      return;
    }
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      setReceiptError('Tipo de archivo no soportado. Permite PDF, JPG, PNG.');
      setReceiptFile(null);
      return;
    }
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setReceiptError('El archivo excede el tamaño máximo de 5MB.');
      setReceiptFile(null);
      return;
    }
    setReceiptFile(file);
    setReceiptError(null);
  };

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
    setDragOver(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errors = validateForm(form);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const data = new FormData();
      data.append('concept', form.concept.slice(0, 500));
      data.append('date', form.date);
      data.append('amount', form.amount);
      if (form.provider) data.append('provider', form.provider);
      if (form.category) data.append('category', form.category);
      if (receiptFile) {
        data.append('receipt_file', receiptFile);
      }

      await onSubmit(expense.id, data);
      onClose();
    } catch (err) {
      const msg = err.response?.data?.detail || 'No se pudo actualizar el gasto. Inténtelo de nuevo.';
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose} data-testid="edit-modal">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* HEADER */}
        <div className={styles.header}>
          <h2 className={styles.title}>Editar Gasto</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar modal">
            ✕
          </button>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <div className={styles.formGroup}>
            <label className={styles.label}>Proveedor / Beneficiario</label>
            <input
              className={styles.input}
              type="text"
              name="provider"
              placeholder="ej. Acme Mantenimiento Co."
              value={form.provider}
              onChange={handleChange}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Categoría</label>
            <select
              className={`${styles.input} ${styles.select}`}
              name="category"
              value={form.category}
              onChange={handleChange}
            >
              <option value="">Seleccionar Categoría</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formRowDouble}>
            <div className={styles.formGroup}>
              <label className={styles.label}>
                Fecha{' '}
                {formErrors.date && <span className={styles.fieldError}>{formErrors.date}</span>}
              </label>
              <input
                className={`${styles.input} ${formErrors.date ? styles.inputError : ''}`}
                type="date"
                name="date"
                value={form.date}
                onChange={handleChange}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>
                Monto ($){' '}
                {formErrors.amount && <span className={styles.fieldError}>{formErrors.amount}</span>}
              </label>
              <input
                className={`${styles.input} ${formErrors.amount ? styles.inputError : ''}`}
                type="number"
                name="amount"
                placeholder="0.00"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>
              Concepto / Descripción
              {formErrors.concept && <span className={styles.fieldError}> {formErrors.concept}</span>}
            </label>
            <textarea
              className={`${styles.input} ${styles.textarea} ${
                formErrors.concept ? styles.inputError : ''
              }`}
              name="concept"
              placeholder="Breve descripción del gasto..."
              value={form.concept}
              onChange={handleChange}
              rows={3}
              maxLength={500}
            />
          </div>

          {/* FILE DROP */}
          <div className={styles.fileLabel}>
            Comprobante / Recibo
            {expense.receipt_file_name && (
              <span className={styles.currentFile}>
                (Actual: {expense.receipt_file_name})
              </span>
            )}
          </div>
          <div
            className={`${styles.dropZone} ${dragOver ? styles.dropOver : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className={styles.fileInput}
              onChange={(e) => handleFileChange(e.target.files[0])}
            />
            <span className={styles.dropIcon}>☁️</span>
            {receiptFile ? (
              <p className={styles.dropText}>
                <strong>Nuevo archivo:</strong> {receiptFile.name}
              </p>
            ) : receiptError ? (
              <p className={styles.dropText} style={{ color: 'var(--color-danger)' }}>
                {receiptError}
              </p>
            ) : (
              <p className={styles.dropText}>
                Arrastre y suelte un nuevo comprobante para reemplazar el actual<br />
                <span>o haga clic para buscar archivos</span>
              </p>
            )}
            <p className={styles.dropHint}>Soporta PDF, JPG, PNG (Máx 5MB)</p>
          </div>

          {submitError && <p className={styles.submitError}>{submitError}</p>}

          <div className={styles.formActions}>
            <button type="button" className={styles.btnCancel} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className={styles.btnSave} disabled={submitting}>
              {submitting ? 'Guardando...' : '💾 Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

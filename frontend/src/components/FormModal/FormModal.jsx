import { useState, useEffect, useRef } from 'react';
import styles from './FormModal.module.css';

export default function FormModal({ isOpen, title, fields = [], initialData, defaultValues, onSubmit, onClose }) {
  const [formData, setFormData] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const fieldsRef = useRef(fields);
  const defaultsRef = useRef(initialData ?? defaultValues);
  fieldsRef.current = fields;
  defaultsRef.current = initialData ?? defaultValues;

  useEffect(() => {
    if (isOpen) {
      const effectiveDefaults = defaultsRef.current ?? {};
      const initial = {};
      fieldsRef.current.forEach((f) => {
        initial[f.name] = effectiveDefaults[f.name] ?? f.defaultValue ?? '';
      });
      setFormData(initial);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (field, value) => {
    const extraUpdates = field.onChange ? field.onChange(value) : null;
    setFormData((prev) => ({
      ...prev,
      [field.name]: value,
      ...(extraUpdates || {}),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(formData);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al guardar');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button className={styles.closeBtn} onClick={onClose} type="button">
            ✕
          </button>
        </div>
        <form className={styles.form} onSubmit={handleSubmit}>
          {fields.map((field) => (
            <div key={field.name} className={styles.field}>
              <label className={styles.label}>
                {field.label}
                {field.required && <span className={styles.required}> *</span>}
              </label>
              {field.type === 'select' ? (
                <select
                  className={styles.input}
                  value={formData[field.name] ?? ''}
                  onChange={(e) => handleSelectChange(field, e.target.value)}
                  required={field.required}
                >
                  <option value="">Seleccionar...</option>
                  {(field.options || []).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : field.type === 'textarea' ? (
                <textarea
                  className={styles.textarea}
                  value={formData[field.name] ?? ''}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  required={field.required}
                  rows={3}
                  placeholder={field.placeholder}
                />
              ) : (
                <input
                  className={styles.input}
                  type={field.type || 'text'}
                  value={formData[field.name] ?? ''}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  required={field.required}
                  placeholder={field.placeholder}
                  min={field.min}
                  step={field.step}
                />
              )}
            </div>
          ))}
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.actions}>
            <button type="button" className={styles.btnCancel} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className={styles.btnSubmit} disabled={submitting}>
              {submitting ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

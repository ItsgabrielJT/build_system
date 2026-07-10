import { useState, useEffect, useRef, useId } from 'react';
import styles from './FormModal.module.css';

export default function FormModal({ isOpen, title, fields = [], initialData, defaultValues, onSubmit, onClose }) {
  const formId = useId();
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
        initial[f.name] = effectiveDefaults[f.name] ?? f.defaultValue ?? (f.type === 'multiselect' ? [] : '');
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
    const invalidMultiselect = fields.find((field) => (
      field.required
      && field.type === 'multiselect'
      && !(formData[field.name] || []).length
    ));
    if (invalidMultiselect) {
      setError(`Seleccione al menos una opción en ${invalidMultiselect.label}`);
      setSubmitting(false);
      return;
    }
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
          {fields.map((field) => {
            if (field.type === 'hidden') {
              return (
                <input
                  key={field.name}
                  type="hidden"
                  value={formData[field.name] ?? ''}
                />
              );
            }
            const fieldId = `${formId}-${field.name}`;
            return (
              <div key={field.name} className={styles.field}>
                <label id={`${fieldId}-label`} className={styles.label} htmlFor={fieldId}>
                  {field.label}
                  {field.required && <span className={styles.required} aria-hidden="true"> *</span>}
                </label>
                {field.type === 'select' ? (
                  <select
                    id={fieldId}
                    className={styles.input}
                    value={formData[field.name] ?? ''}
                    onChange={(e) => handleSelectChange(field, e.target.value)}
                    required={field.required}
                  >
                    <option value="">Seleccionar...</option>
                    {(field.options || []).map((opt, idx) => {
                      if (opt.options) {
                        return (
                          <optgroup key={opt.label || idx} label={opt.label}>
                            {opt.options.map((subOpt) => (
                              <option key={subOpt.value} value={subOpt.value}>
                                {subOpt.label}
                              </option>
                            ))}
                          </optgroup>
                        );
                      }
                      return (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      );
                    })}
                  </select>
                ) : field.type === 'multiselect' ? (
                  <div id={fieldId} className={styles.checkList} role="group" aria-labelledby={`${fieldId}-label`}>
                    {(field.options || []).map((opt) => {
                      const checked = (formData[field.name] || []).includes(opt.value);
                      return (
                        <label key={opt.value} className={styles.checkItem}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const current = formData[field.name] || [];
                              const next = e.target.checked
                                ? [...current, opt.value]
                                : current.filter((value) => value !== opt.value);
                              handleChange(field.name, next);
                            }}
                          />
                          <span>{opt.label}</span>
                        </label>
                      );
                    })}
                    {!(field.options || []).length && (
                      <span className={styles.emptyHint}>No hay opciones disponibles.</span>
                    )}
                  </div>
                ) : field.type === 'textarea' ? (
                  <textarea
                    id={fieldId}
                    className={styles.textarea}
                    value={formData[field.name] ?? ''}
                    onChange={(e) => handleChange(field.name, e.target.value)}
                    required={field.required}
                    rows={3}
                    placeholder={field.placeholder}
                  />
                ) : (
                  <input
                    id={fieldId}
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
            );
          })}
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

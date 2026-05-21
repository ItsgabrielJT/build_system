import styles from './PeriodSelector.module.css';

export default function PeriodSelector({ period, onChange, label, required }) {
  return (
    <div className={styles.wrapper}>
      {label && (
        <label className={styles.label}>
          {label}
          {required && <span className={styles.required}> *</span>}
        </label>
      )}
      <input
        type="month"
        className={styles.input}
        value={period}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
    </div>
  );
}

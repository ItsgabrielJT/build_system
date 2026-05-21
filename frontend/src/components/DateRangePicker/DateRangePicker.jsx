import styles from './DateRangePicker.module.css';

export default function DateRangePicker({ startPeriod, endPeriod, onChange, label }) {
  return (
    <div className={styles.wrapper}>
      {label && <span className={styles.label}>{label}</span>}
      <div className={styles.inputs}>
        <input
          type="month"
          className={styles.input}
          value={startPeriod}
          onChange={(e) => onChange({ startPeriod: e.target.value, endPeriod })}
          placeholder="Desde"
        />
        <span className={styles.sep}>—</span>
        <input
          type="month"
          className={styles.input}
          value={endPeriod}
          onChange={(e) => onChange({ startPeriod, endPeriod: e.target.value })}
          placeholder="Hasta"
        />
      </div>
    </div>
  );
}

import styles from './StatsCard.module.css';

const ICONS = {
  arrow: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  ),
  bank: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="22" x2="21" y2="22" />
      <line x1="6" y1="18" x2="6" y2="11" />
      <line x1="10" y1="18" x2="10" y2="11" />
      <line x1="14" y1="18" x2="14" y2="11" />
      <line x1="18" y1="18" x2="18" y2="11" />
      <polygon points="12 2 20 7 4 7" />
    </svg>
  ),
  clock: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
};

export default function StatsCard({ title, value, icon, badge, progressBar, progressValue, progressLabel, badgeSubtext }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardTop}>
        <span className={styles.cardTitle}>{title}</span>
        {icon && (
          <span className={`${styles.iconCircle} ${styles[`icon_${icon}`]}`}>
            {ICONS[icon]}
          </span>
        )}
      </div>
      <div className={styles.cardValue}>{value}</div>
      {badge && (
        <div className={styles.badgeRow}>
          <span className={`${styles.badge} ${styles[`badge_${badge.color}`]}`}>
            {badge.text}
          </span>
          {badgeSubtext && <span className={styles.badgeSubtext}>{badgeSubtext}</span>}
        </div>
      )}
      {progressBar && (
        <div className={styles.progressWrapper}>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${Math.min(Math.max(progressValue ?? 0, 0), 100)}%` }}
            />
          </div>
          {progressLabel && <span className={styles.progressLabel}>{progressLabel}</span>}
        </div>
      )}
    </div>
  );
}

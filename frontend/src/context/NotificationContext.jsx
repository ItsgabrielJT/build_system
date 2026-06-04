import { createContext, useContext, useState, useCallback } from 'react';
import styles from './NotificationContext.module.css';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  const addNotification = useCallback((message, type = 'success', duration = 4000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setNotifications((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, duration);
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const success = useCallback((msg, duration) => addNotification(msg, 'success', duration), [addNotification]);
  const error = useCallback((msg, duration) => addNotification(msg, 'error', duration), [addNotification]);
  const warning = useCallback((msg, duration) => addNotification(msg, 'warning', duration), [addNotification]);
  const info = useCallback((msg, duration) => addNotification(msg, 'info', duration), [addNotification]);

  return (
    <NotificationContext.Provider value={{ success, error, warning, info }}>
      {children}
      <div className={styles.toastContainer} aria-live="polite">
        {notifications.map((n) => (
          <div 
            key={n.id} 
            className={`${styles.toast} ${styles[n.type]}`} 
            onClick={() => removeNotification(n.id)}
            role="alert"
          >
            <div className={styles.icon}>
              {n.type === 'success' && '✓'}
              {n.type === 'error' && '✕'}
              {n.type === 'warning' && '⚠'}
              {n.type === 'info' && 'ℹ'}
            </div>
            <div className={styles.message}>{n.message}</div>
            <button className={styles.closeBtn} aria-label="Cerrar notificación">×</button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}

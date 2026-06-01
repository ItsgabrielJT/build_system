import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useAdminNotifications } from '../../hooks/useAdminNotifications';
import styles from './Navbar.module.css';

const IconBell = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);

const IconSettings = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

const IconSearch = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

const IconMenu = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6"/>
    <line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
);

const ROLE_LABELS = {
  ADMIN: 'SÚPER USUARIO',
  PROPIETARIO: 'PROPIETARIO',
};

export default function Navbar({ buildingName = 'Edificio Horizonte', onToggleSidebar }) {
  const { user, role } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationRef = useRef(null);
  const {
    notifications,
    total,
    loading,
    error,
    fetchNotifications,
    enabled: notificationsEnabled,
  } = useAdminNotifications();
  const isReports = pathname === '/admin/reports';
  const userInitial = user?.email?.charAt(0).toUpperCase() || 'U';
  const displayName = user?.email?.split('@')[0] || 'Usuario';
  const roleLabel = ROLE_LABELS[role] || role || '';

  useEffect(() => {
    if (!isNotificationsOpen) return undefined;

    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setIsNotificationsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isNotificationsOpen]);

  const handleNotificationToggle = async () => {
    if (!notificationsEnabled) return;

    if (!isNotificationsOpen) {
      await fetchNotifications();
    }

    setIsNotificationsOpen((current) => !current);
  };

  const handleNotificationClick = () => {
    setIsNotificationsOpen(false);
    navigate('/admin/payments');
  };

  const formatNotificationDate = (value) => {
    if (!value) return 'Sin fecha';
    return new Intl.DateTimeFormat('es', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  };

  return (
    <header className={`${styles.navbar} ${isReports ? styles.reportsNavbar : ''}`}>
      <div className={styles.left}>
        <button className={styles.menuBtn} onClick={onToggleSidebar} aria-label="Toggle sidebar">
          <IconMenu />
        </button>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}><IconSearch /></span>
          <input
            className={styles.searchInput}
            type="text"
            placeholder={isReports ? 'Buscar reportes...' : 'Buscar por nombre o unidad...'}
          />
        </div>
        {!isReports && (
          <>
            <span className={styles.separator} />
            <span className={styles.buildingName}>{buildingName}</span>
          </>
        )}
      </div>

      <div className={styles.right}>
        {isReports && <span className={styles.reportBuildingName}>{buildingName}</span>}
        <div className={styles.notificationWrap} ref={notificationRef}>
          <button className={styles.iconBtn} aria-label="Notificaciones" onClick={handleNotificationToggle}>
            <IconBell />
            {notificationsEnabled && total > 0 && (
              <span className={styles.notificationBadge}>{total > 99 ? '99+' : total}</span>
            )}
          </button>

          {notificationsEnabled && isNotificationsOpen && (
            <div className={styles.notificationPanel}>
              <div className={styles.notificationPanelHeader}>
                <div>
                  <strong>Notificaciones</strong>
                  <span>{total} activas</span>
                </div>
                <button type="button" className={styles.notificationRefreshBtn} onClick={fetchNotifications}>
                  Actualizar
                </button>
              </div>

              {loading ? (
                <div className={styles.notificationState}>Cargando notificaciones...</div>
              ) : error ? (
                <div className={styles.notificationError}>{error}</div>
              ) : notifications.length ? (
                <div className={styles.notificationList}>
                  {notifications.map((notification) => (
                    <button
                      key={notification.id}
                      type="button"
                      className={styles.notificationItem}
                      onClick={handleNotificationClick}
                    >
                      <strong>{notification.title || 'Notificación del sistema'}</strong>
                      <span>{notification.body || 'Sin detalle adicional.'}</span>
                      <small>{formatNotificationDate(notification.created_at)}</small>
                    </button>
                  ))}
                </div>
              ) : (
                <div className={styles.notificationState}>No hay notificaciones pendientes.</div>
              )}
            </div>
          )}
        </div>
        <button className={styles.iconBtn} aria-label="Configuración">
          <IconSettings />
        </button>
        <div className={styles.userInfo}>
          <div className={styles.userText}>
            <span className={styles.userName}>{displayName}</span>
            <span className={styles.userRole}>{roleLabel}</span>
          </div>
          <div className={styles.avatar}>{userInitial}</div>
        </div>
      </div>
    </header>
  );
}

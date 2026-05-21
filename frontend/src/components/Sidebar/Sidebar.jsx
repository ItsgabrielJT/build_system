import { NavLink } from 'react-router-dom';
import styles from './Sidebar.module.css';

const ADMIN_LINKS = [
  { to: '/admin/owners', label: 'Propietarios', icon: '👤' },
  { to: '/admin/apartments', label: 'Departamentos', icon: '🏢' },
  { to: '/admin/fees', label: 'Cuotas', icon: '💰' },
  { to: '/admin/payments', label: 'Pagos', icon: '💳' },
  { to: '/admin/fines', label: 'Multas', icon: '⚠️' },
  { to: '/admin/expenses', label: 'Gastos', icon: '📋' },
  { to: '/admin/delinquency', label: 'Morosidad', icon: '🔴' },
  { to: '/admin/reports', label: 'Reportes', icon: '📊' },
];

const OWNER_LINKS = [
  { to: '/owner/apartments', label: 'Mis Departamentos', icon: '🏠' },
  { to: '/owner/account-statement', label: 'Estado de Cuenta', icon: '📄' },
];

export default function Sidebar({ role }) {
  const links = role === 'ADMIN' ? ADMIN_LINKS : OWNER_LINKS;

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.brandIcon}>🏛️</span>
        <span className={styles.brandName}>Gestión Edificios</span>
      </div>
      <nav className={styles.nav}>
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `${styles.link} ${isActive ? styles.linkActive : ''}`
            }
          >
            <span className={styles.linkIcon}>{link.icon}</span>
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

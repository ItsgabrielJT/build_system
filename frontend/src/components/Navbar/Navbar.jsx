import { useAuth } from '../../hooks/useAuth';
import styles from './Navbar.module.css';

export default function Navbar() {
  const { user, role, logout } = useAuth();

  return (
    <header className={styles.navbar}>
      <div className={styles.spacer} />
      <div className={styles.right}>
        <span className={styles.roleTag}>{role}</span>
        <span className={styles.email}>{user?.email}</span>
        <button className={styles.btnSignOut} onClick={logout}>
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}

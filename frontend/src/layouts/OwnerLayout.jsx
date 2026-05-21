import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar/Sidebar';
import Navbar from '../components/Navbar/Navbar';
import styles from './OwnerLayout.module.css';

export default function OwnerLayout() {
  return (
    <div className={styles.layout}>
      <Sidebar role="PROPIETARIO" />
      <div className={styles.main}>
        <Navbar />
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

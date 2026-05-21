import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar/Sidebar';
import Navbar from '../components/Navbar/Navbar';
import styles from './AdminLayout.module.css';

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={styles.layout}>
      <Sidebar role="ADMIN" collapsed={collapsed} />
      <div
        className={styles.main}
        style={{ marginLeft: collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)' }}
      >
        <Navbar onToggleSidebar={() => setCollapsed(c => !c)} />
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}


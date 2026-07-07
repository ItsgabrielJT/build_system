import { useCallback, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar/Sidebar';
import Navbar from '../components/Navbar/Navbar';
import { useAuth } from '../hooks/useAuth';
import { getBuildingConfig } from '../services/buildingService';
import styles from './AdminLayout.module.css';

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { token } = useAuth();
  const [building, setBuilding] = useState(null);

  const fetchPrimaryBuilding = useCallback(async () => {
    if (!token) return null;
    try {
      const primary = await getBuildingConfig(token);
      setBuilding(primary);
      return primary;
    } catch {
      setBuilding(null);
      return null;
    }
  }, [token]);

  useEffect(() => {
    fetchPrimaryBuilding();
  }, [fetchPrimaryBuilding]);

  return (
    <div className={styles.layout}>
      <Sidebar role="ADMIN" collapsed={collapsed} />
      <div
        className={styles.main}
        style={{ marginLeft: collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)' }}
      >
        <Navbar
          buildingName={building?.name || 'Edificio Principal'}
          onToggleSidebar={() => setCollapsed(c => !c)}
        />
        <main className={styles.content}>
          <Outlet context={{ building, refreshBuilding: fetchPrimaryBuilding }} />
        </main>
      </div>
    </div>
  );
}

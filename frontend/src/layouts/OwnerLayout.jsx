import { useCallback, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar/Sidebar';
import Navbar from '../components/Navbar/Navbar';
import { useAuth } from '../hooks/useAuth';
import { getBuildingConfig } from '../services/buildingService';
import { getOwnerProfile, getOwnerProfilePhotoBlob } from '../services/ownerService';
import styles from './OwnerLayout.module.css';

export default function OwnerLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { token } = useAuth();
  const [building, setBuilding] = useState(null);
  const [ownerProfile, setOwnerProfile] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);

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

  const fetchOwnerProfile = useCallback(async () => {
    if (!token) return null;
    try {
      const profile = await getOwnerProfile(token);
      setOwnerProfile(profile);
      if (profile.photo_file_name) {
        const blob = await getOwnerProfilePhotoBlob(profile.id, token);
        const url = URL.createObjectURL(blob);
        setAvatarUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      } else {
        setAvatarUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
      }
      return profile;
    } catch (e) {
      console.error('Error fetching owner profile in layout:', e);
      return null;
    }
  }, [token]);

  useEffect(() => {
    fetchPrimaryBuilding();
    fetchOwnerProfile();
    return () => {
      setAvatarUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [fetchPrimaryBuilding, fetchOwnerProfile]);

  return (
    <div className={styles.layout}>
      <Sidebar role="PROPIETARIO" collapsed={collapsed} />
      <div
        className={styles.main}
        style={{ marginLeft: collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)' }}
      >
        <Navbar
          buildingName={building?.name || ''}
          onToggleSidebar={() => setCollapsed(c => !c)}
          avatarUrl={avatarUrl}
          ownerProfile={ownerProfile}
        />
        <main className={styles.content}>
          <Outlet
            context={{
              building,
              refreshBuilding: fetchPrimaryBuilding,
              ownerProfile,
              refreshOwnerProfile: fetchOwnerProfile
            }}
          />
        </main>
      </div>
    </div>
  );
}

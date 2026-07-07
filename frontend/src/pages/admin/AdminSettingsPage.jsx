import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../context/NotificationContext';
import {
  getBuildingAssetBlob,
  getBuildingConfig,
  updateBuildingConfig,
} from '../../services/buildingService';
import styles from './AdminSettingsPage.module.css';

const initialForm = {
  name: '',
  address: '',
  phone: '',
  email: '',
};

export default function AdminSettingsPage() {
  const { token } = useAuth();
  const { success, error: toastError } = useNotification();
  const layoutContext = useOutletContext() || {};
  const [building, setBuilding] = useState(layoutContext.building || null);
  const [formData, setFormData] = useState(initialForm);
  const [assetFiles, setAssetFiles] = useState({
    photo_file: null,
    logo_file: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [assetPreviews, setAssetPreviews] = useState({
    photo: null,
    logo: null,
  });

  useEffect(() => {
    if (layoutContext.building) {
      setBuilding(layoutContext.building);
    }
  }, [layoutContext.building]);

  useEffect(() => {
    let cancelled = false;

    async function loadBuilding() {
      if (building || !token) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const config = await getBuildingConfig(token);
        if (!cancelled) setBuilding(config);
      } catch {
        if (!cancelled) setError('Error al cargar la configuración del edificio.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadBuilding();
    return () => {
      cancelled = true;
    };
  }, [building, token]);

  useEffect(() => {
    if (!building) return;
    setFormData({
      name: building.name || '',
      address: building.address || '',
      phone: building.phone || '',
      email: building.email || '',
    });
  }, [building]);

  useEffect(() => {
    const nextUrls = {
      photo: assetFiles.photo_file ? URL.createObjectURL(assetFiles.photo_file) : null,
      logo: assetFiles.logo_file ? URL.createObjectURL(assetFiles.logo_file) : null,
    };

    setAssetPreviews((prev) => ({
      photo: nextUrls.photo || prev.photo,
      logo: nextUrls.logo || prev.logo,
    }));

    return () => {
      if (nextUrls.photo) URL.revokeObjectURL(nextUrls.photo);
      if (nextUrls.logo) URL.revokeObjectURL(nextUrls.logo);
    };
  }, [assetFiles.photo_file, assetFiles.logo_file]);

  useEffect(() => {
    if (!building?.id || !token) return undefined;

    let cancelled = false;
    const loadedUrls = [];

    async function loadSavedPreviews() {
      const entries = [
        ['photo', building.photo_file_name],
        ['logo', building.logo_file_name],
      ];

      const previews = {};
      await Promise.all(entries.map(async ([assetType, fileName]) => {
        if (!fileName || assetFiles[`${assetType}_file`]) return;
        try {
          const blob = await getBuildingAssetBlob(building.id, assetType, token);
          const url = URL.createObjectURL(blob);
          loadedUrls.push(url);
          previews[assetType] = url;
        } catch {
          previews[assetType] = null;
        }
      }));

      if (!cancelled && Object.keys(previews).length) {
        setAssetPreviews((prev) => ({ ...prev, ...previews }));
      }
    }

    loadSavedPreviews();

    return () => {
      cancelled = true;
      loadedUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [
    building?.id,
    building?.photo_file_name,
    building?.logo_file_name,
    token,
    assetFiles.photo_file,
    assetFiles.logo_file,
  ]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (event) => {
    const { name, files } = event.target;
    setAssetFiles((prev) => ({ ...prev, [name]: files?.[0] || null }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!building?.id) return;

    setSaving(true);
    setError(null);
    try {
      const updated = await updateBuildingConfig({ ...formData, ...assetFiles }, token);
      setBuilding(updated);
      setAssetFiles({ photo_file: null, logo_file: null });
      await layoutContext.refreshBuilding?.();
      success('Configuración del edificio guardada');
    } catch (err) {
      const message = err.response?.data?.detail || 'Error al guardar la configuración del edificio.';
      setError(message);
      toastError(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Cargando configuración...</div>;
  }

  return (
    <div className={styles.page}>
      <section className={styles.header}>
        <div>
          <div className={styles.breadcrumb}>Admin / Configuración</div>
          <h1>Configuración del edificio</h1>
          <p>Estos datos se usan en el título del sistema, comprobantes y PDFs generados.</p>
        </div>
      </section>

      {error ? <div className={styles.errorBanner}>{error}</div> : null}

      {!building ? (
        <div className={styles.emptyState}>No hay un edificio configurado.</div>
      ) : (
        <form className={styles.form} onSubmit={handleSubmit}>
          <section className={styles.panel}>
            <h2>Datos generales</h2>
            <div className={styles.grid}>
              <label className={styles.field}>
                <span>Nombre del edificio</span>
                <input
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="Ej. Torres del Parque"
                />
              </label>

              <label className={styles.field}>
                <span>Email</span>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="contacto@edificio.com"
                />
              </label>

              <label className={styles.field}>
                <span>Dirección</span>
                <input
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Calle principal 123"
                />
              </label>

              <label className={styles.field}>
                <span>Teléfono</span>
                <input
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+593 99 999 9999"
                />
              </label>
            </div>
          </section>

          <section className={styles.panel}>
            <h2>Imagen institucional</h2>
            <div className={styles.assetGrid}>
              <label className={styles.fileField}>
                <span>Foto del edificio</span>
                <div className={styles.previewBox}>
                  {assetPreviews.photo ? (
                    <img src={assetPreviews.photo} alt="Foto del edificio" />
                  ) : (
                    <strong>Sin foto</strong>
                  )}
                </div>
                <input
                  type="file"
                  name="photo_file"
                  accept="image/png,image/jpeg"
                  onChange={handleFileChange}
                />
                <small>
                  {assetFiles.photo_file?.name || building.photo_file_name || 'Sin foto configurada'}
                </small>
              </label>

              <label className={styles.fileField}>
                <span>Logo para comprobantes y PDFs</span>
                <div className={`${styles.previewBox} ${styles.logoPreview}`}>
                  {assetPreviews.logo ? (
                    <img src={assetPreviews.logo} alt="Logo para comprobantes y PDFs" />
                  ) : (
                    <strong>Sin logo</strong>
                  )}
                </div>
                <input
                  type="file"
                  name="logo_file"
                  accept="image/png,image/jpeg"
                  onChange={handleFileChange}
                />
                <small>
                  {assetFiles.logo_file?.name || building.logo_file_name || 'Sin logo configurado'}
                </small>
              </label>
            </div>
          </section>

          <div className={styles.actions}>
            <button type="submit" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar configuración'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

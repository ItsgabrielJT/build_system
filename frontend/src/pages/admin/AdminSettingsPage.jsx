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
    signature_file: null,
    seal_file: null,
    regulation_file: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [assetPreviews, setAssetPreviews] = useState({
    photo: null,
    logo: null,
    signature: null,
    seal: null,
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
      signature: assetFiles.signature_file ? URL.createObjectURL(assetFiles.signature_file) : null,
      seal: assetFiles.seal_file ? URL.createObjectURL(assetFiles.seal_file) : null,
    };

    setAssetPreviews((prev) => ({
      photo: nextUrls.photo || prev.photo,
      logo: nextUrls.logo || prev.logo,
      signature: nextUrls.signature || prev.signature,
      seal: nextUrls.seal || prev.seal,
    }));

    return () => {
      if (nextUrls.photo) URL.revokeObjectURL(nextUrls.photo);
      if (nextUrls.logo) URL.revokeObjectURL(nextUrls.logo);
      if (nextUrls.signature) URL.revokeObjectURL(nextUrls.signature);
      if (nextUrls.seal) URL.revokeObjectURL(nextUrls.seal);
    };
  }, [assetFiles.photo_file, assetFiles.logo_file, assetFiles.signature_file, assetFiles.seal_file]);

  useEffect(() => {
    if (!building?.id || !token) return undefined;

    let cancelled = false;
    const loadedUrls = [];

    async function loadSavedPreviews() {
      const entries = [
        ['photo', building.photo_file_name],
        ['logo', building.logo_file_name],
        ['signature', building.signature_file_name],
        ['seal', building.seal_file_name],
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
    building?.signature_file_name,
    building?.seal_file_name,
    token,
    assetFiles.photo_file,
    assetFiles.logo_file,
    assetFiles.signature_file,
    assetFiles.seal_file,
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
      setAssetFiles({
        photo_file: null,
        logo_file: null,
        signature_file: null,
        seal_file: null,
        regulation_file: null,
      });
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
          <div className={styles.settingsColumns}>
            <div className={styles.mainColumn}>
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
            </div>

            <div className={styles.sideColumn}>
              <section className={styles.panel}>
                <h2>Firma autorizada</h2>
                <div className={styles.singleAssetGrid}>
                  <label className={styles.fileField}>
                    <span>Firma para comprobantes (PNG)</span>
                    <div className={`${styles.previewBox} ${styles.logoPreview}`}>
                      {assetPreviews.signature ? (
                        <img src={assetPreviews.signature} alt="Firma autorizada" />
                      ) : (
                        <strong>Sin firma</strong>
                      )}
                    </div>
                    <input
                      type="file"
                      name="signature_file"
                      accept="image/png"
                      onChange={handleFileChange}
                    />
                    <small>
                      {assetFiles.signature_file?.name || building.signature_file_name || 'Sin firma configurada'}
                    </small>
                  </label>
                </div>
              </section>

              <section className={styles.panel}>
                <h2>Sello institucional</h2>
                <div className={styles.singleAssetGrid}>
                  <label className={styles.fileField}>
                    <span>Sello para comprobantes y documentos</span>
                    <div className={`${styles.previewBox} ${styles.logoPreview}`}>
                      {assetPreviews.seal ? (
                        <img src={assetPreviews.seal} alt="Sello institucional" />
                      ) : (
                        <strong>Sin sello</strong>
                      )}
                    </div>
                    <input
                      type="file"
                      name="seal_file"
                      accept="image/png,image/jpeg"
                      onChange={handleFileChange}
                    />
                    <small>
                      {assetFiles.seal_file?.name || building.seal_file_name || 'Sin sello configurado'}
                    </small>
                  </label>
                </div>
              </section>

              <section className={styles.panel}>
                <h2>Reglamento del edificio</h2>
                <div className={styles.singleAssetGrid}>
                  <label className={styles.fileField}>
                    <span>Documento oficial (PDF)</span>
                    <div className={styles.documentPreviewBox}>
                      <strong>
                        {assetFiles.regulation_file?.name || building.regulation_file_name || 'Sin reglamento cargado'}
                      </strong>
                      <small>Solo formato PDF</small>
                    </div>
                    <input
                      type="file"
                      name="regulation_file"
                      accept="application/pdf"
                      onChange={handleFileChange}
                    />
                    <small>
                      {assetFiles.regulation_file?.name || building.regulation_file_name || 'Sin reglamento configurado'}
                    </small>
                  </label>
                </div>
              </section>
            </div>
          </div>

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

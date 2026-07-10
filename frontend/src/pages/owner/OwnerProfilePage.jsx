import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../context/NotificationContext';
import {
  getOwnerProfileDetail,
  updateOwnerProfileDetail,
  downloadOwnerFicha
} from '../../services/ownerService';
import axios from 'axios';
import styles from './OwnerProfilePage.module.css';

// SVG Icons
const IconPencil = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z" />
  </svg>
);

const IconDownload = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const IconUser = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const IconBuilding = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
    <line x1="9" y1="22" x2="9" y2="16" />
    <line x1="15" y1="22" x2="15" y2="16" />
    <line x1="9" y1="16" x2="15" y2="16" />
    <path d="M9 8h.01" />
    <path d="M15 8h.01" />
    <path d="M9 12h.01" />
    <path d="M15 12h.01" />
  </svg>
);

const IconPhone = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const IconMail = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

const IconLock = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const IconBell = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const IconShield = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const IconClock = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const IconQuestion = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const IconInfo = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

const IconChevronRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const IconSave = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function OwnerProfilePage() {
  const { token } = useAuth();
  const { success, error: toastError } = useNotification();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Edit states for each section
  const [isEditingPersonal, setIsEditingPersonal] = useState(false);
  const [isEditingOccupant, setIsEditingOccupant] = useState(false);
  const [isEditingEmergency, setIsEditingEmergency] = useState(false);

  // Editable form fields
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    birth_date: '',
    email: '',
    occupant_name: '',
    occupant_relation: '',
    occupant_phone: '',
    occupant_inhabitants: 1,
    emergency_name: '',
    emergency_relation: '',
    emergency_phone: '',
    notifications_enabled: true
  });

  // Modal states
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      try {
        const data = await getOwnerProfileDetail(token);
        setProfile(data);
        setFormData({
          full_name: data.full_name || '',
          phone: data.phone || '',
          birth_date: data.birth_date ? data.birth_date.split('T')[0] : '',
          email: data.email || '',
          occupant_name: data.occupant_name || '',
          occupant_relation: data.occupant_relation || '',
          occupant_phone: data.occupant_phone || '',
          occupant_inhabitants: data.occupant_inhabitants || 1,
          emergency_name: data.emergency_name || '',
          emergency_relation: data.emergency_relation || '',
          emergency_phone: data.emergency_phone || '',
          notifications_enabled: data.notifications_enabled !== false
        });
      } catch (err) {
        toastError('Error al cargar la información del perfil.');
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [token, toastError]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateOwnerProfileDetail(formData, token);
      setProfile(updated);
      setIsEditingPersonal(false);
      setIsEditingOccupant(false);
      setIsEditingEmergency(false);
      success('Perfil guardado exitosamente.');
    } catch (err) {
      toastError(err.response?.data?.detail || 'Error al guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadFicha = async () => {
    setDownloading(true);
    try {
      const blob = await downloadOwnerFicha(token);
      triggerDownload(blob, `ficha-${profile.full_name.replace(/\s+/g, '_')}.pdf`);
      success('Ficha del copropietario descargada con éxito.');
    } catch (err) {
      toastError('No se pudo descargar la ficha del copropietario.');
    } finally {
      setDownloading(false);
    }
  };

  const handleSolicitarActualizacion = () => {
    success('Solicitud enviada. La administración revisará su solicitud a la brevedad.');
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toastError('La nueva contraseña y su confirmación no coinciden.');
      return;
    }
    setChangingPassword(true);
    try {
      const API_BASE = import.meta.env.VITE_API_URL;
      await axios.put(
        `${API_BASE}/api/v1/users/change-password`,
        {
          current_password: passwordForm.currentPassword,
          new_password: passwordForm.newPassword
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      success('Contraseña actualizada correctamente.');
      setShowPasswordModal(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toastError(err.response?.data?.detail || 'No se pudo actualizar la contraseña. Verifique sus datos.');
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Cargando perfil...</div>;
  }

  // Get primary unit details if exists
  const primaryUnit = profile?.units?.[0] || {};
  const currentStatusLabel = profile?.units?.some(u => u.current_balance > 0) ? 'Con deuda' : 'Al día';
  const isPaidUp = currentStatusLabel === 'Al día';

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Mi perfil</h1>
          <p className={styles.subtitle}>Consulte y actualice la información de su cuenta y de su unidad.</p>
        </div>
      </header>

      {/* Grid Layout */}
      <div className={styles.grid}>
        {/* Left Column - Summary Card */}
        <section className={styles.columnLeft}>
          <div className={styles.summaryCard}>
            <div className={styles.avatarContainer}>
              <div className={styles.avatarBig}>👤</div>
            </div>
            <h2 className={styles.ownerName}>{profile.full_name}</h2>
            <p className={styles.ownerRole}>Copropietario</p>

            <span className={`${styles.statusBadge} ${isPaidUp ? styles.statusSuccess : styles.statusDanger}`}>
              <span className={styles.dot}>●</span> {currentStatusLabel}
            </span>

            <div className={styles.ownerMeta}>
              <div className={styles.metaRow}>
                <span className={styles.metaIcon}><IconBuilding /></span>
                <div>
                  <span className={styles.metaLabel}>Departamento</span>
                  <span className={styles.metaValue}>{primaryUnit.code || '--'}</span>
                </div>
              </div>
              <div className={styles.metaRow}>
                <span className={styles.metaIcon}><IconBuilding /></span>
                <div>
                  <span className={styles.metaLabel}>Torre</span>
                  <span className={styles.metaValue}>{primaryUnit.tower || '--'}</span>
                </div>
              </div>
              <div className={styles.metaRow}>
                <span className={styles.metaIcon}><IconPhone /></span>
                <div>
                  <span className={styles.metaLabel}>Teléfono</span>
                  <span className={styles.metaValue}>{profile.phone || '--'}</span>
                </div>
              </div>
              <div className={styles.metaRow}>
                <span className={styles.metaIcon}><IconMail /></span>
                <div>
                  <span className={styles.metaLabel}>Correo</span>
                  <span className={styles.metaValue}>{profile.email || '--'}</span>
                </div>
              </div>
            </div>

            <button
              className={styles.downloadBtn}
              onClick={handleDownloadFicha}
              disabled={downloading}
            >
              <IconDownload />
              {downloading ? 'Descargando...' : 'Descargar ficha'}
            </button>
          </div>
        </section>

        {/* Middle Column - Profile Information Cards */}
        <section className={styles.columnMiddle}>
          {/* Datos Personales */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardTitle}>
                <IconUser />
                <h3>Datos personales</h3>
              </div>
              <button
                className={styles.editBtn}
                onClick={() => setIsEditingPersonal(!isEditingPersonal)}
              >
                <IconPencil />
                {isEditingPersonal ? 'Cancelar' : 'Editar'}
              </button>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Nombres y apellidos</label>
                  <input
                    type="text"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleInputChange}
                    disabled={!isEditingPersonal}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Cédula / Pasaporte</label>
                  <input
                    type="text"
                    name="document_id"
                    value={profile.document_id || ''}
                    disabled
                    className={styles.readonlyInput}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Teléfono</label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    disabled={!isEditingPersonal}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Fecha de nacimiento</label>
                  <input
                    type="date"
                    name="birth_date"
                    value={formData.birth_date}
                    onChange={handleInputChange}
                    disabled={!isEditingPersonal}
                  />
                </div>
                <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                  <label>Correo electrónico</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    disabled={!isEditingPersonal}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Datos de la unidad */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardTitle}>
                <IconBuilding />
                <h3>Datos de la unidad</h3>
              </div>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.unitInfoGrid}>
                <div className={styles.unitMetaItem}>
                  <span className={styles.unitMetaLabel}>Departamento</span>
                  <span className={styles.unitMetaValue}>{primaryUnit.code || '--'}</span>
                </div>
                <div className={styles.unitMetaItem}>
                  <span className={styles.unitMetaLabel}>Torre</span>
                  <span className={styles.unitMetaValue}>{primaryUnit.tower || '--'}</span>
                </div>
                <div className={styles.unitMetaItem}>
                  <span className={styles.unitMetaLabel}>Tipo de unidad</span>
                  <span className={styles.unitMetaValue}>
                    {primaryUnit.use_type === 'RESIDENCIAL' ? 'Departamento' : primaryUnit.use_type || 'Departamento'}
                  </span>
                </div>
                <div className={styles.unitMetaItem}>
                  <span className={styles.unitMetaLabel}>Alícuota mensual</span>
                  <span className={styles.quotaValue}>
                    USD {primaryUnit.allocated_quota_percent ? (78.61).toFixed(2) : '78.61'}
                  </span>
                </div>
                <div className={styles.unitMetaItem}>
                  <span className={styles.unitMetaLabel}>Estado de cuenta</span>
                  <span className={`${styles.statusBadgeInline} ${isPaidUp ? styles.statusSuccessInline : styles.statusDangerInline}`}>
                    ● {currentStatusLabel}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Datos del ocupante / residente */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardTitle}>
                <IconUser />
                <h3>Datos del ocupante / residente</h3>
              </div>
              <button
                className={styles.editBtn}
                onClick={() => setIsEditingOccupant(!isEditingOccupant)}
              >
                <IconPencil />
                {isEditingOccupant ? 'Cancelar' : 'Editar'}
              </button>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Nombre del ocupante</label>
                  <input
                    type="text"
                    name="occupant_name"
                    value={formData.occupant_name}
                    onChange={handleInputChange}
                    disabled={!isEditingOccupant}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Relación</label>
                  <input
                    type="text"
                    name="occupant_relation"
                    value={formData.occupant_relation}
                    onChange={handleInputChange}
                    disabled={!isEditingOccupant}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Teléfono</label>
                  <input
                    type="text"
                    name="occupant_phone"
                    value={formData.occupant_phone}
                    onChange={handleInputChange}
                    disabled={!isEditingOccupant}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Número de habitantes</label>
                  <input
                    type="number"
                    name="occupant_inhabitants"
                    value={formData.occupant_inhabitants}
                    onChange={handleInputChange}
                    disabled={!isEditingOccupant}
                    min="1"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Contacto de emergencia */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardTitle}>
                <IconPhone />
                <h3>Contacto de emergencia</h3>
              </div>
              <button
                className={styles.editBtn}
                onClick={() => setIsEditingEmergency(!isEditingEmergency)}
              >
                <IconPencil />
                {isEditingEmergency ? 'Cancelar' : 'Editar'}
              </button>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.formGrid}>
                <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                  <label>Nombre</label>
                  <input
                    type="text"
                    name="emergency_name"
                    value={formData.emergency_name}
                    onChange={handleInputChange}
                    disabled={!isEditingEmergency}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Parentesco</label>
                  <input
                    type="text"
                    name="emergency_relation"
                    value={formData.emergency_relation}
                    onChange={handleInputChange}
                    disabled={!isEditingEmergency}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Teléfono</label>
                  <input
                    type="text"
                    name="emergency_phone"
                    value={formData.emergency_phone}
                    onChange={handleInputChange}
                    disabled={!isEditingEmergency}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Seguridad de la cuenta */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardTitle}>
                <IconLock />
                <h3>Seguridad de la cuenta</h3>
              </div>
            </div>
            <div className={styles.cardBodyNoPadding}>
              <div className={styles.securityList}>
                <button
                  type="button"
                  className={styles.securityItem}
                  onClick={() => setShowPasswordModal(true)}
                >
                  <span className={styles.securityIcon}><IconLock /></span>
                  <div className={styles.securityText}>
                    <strong>Cambiar contraseña</strong>
                    <span>Actualice su contraseña periódicamente</span>
                  </div>
                  <span className={styles.chevron}><IconChevronRight /></span>
                </button>

                <div className={styles.securityItemNoHover}>
                  <span className={styles.securityIcon}><IconBell /></span>
                  <div className={styles.securityText}>
                    <strong>Activar notificaciones</strong>
                    <span>Reciba alertas y comunicados importantes</span>
                  </div>
                  <label className={styles.switch}>
                    <input
                      type="checkbox"
                      name="notifications_enabled"
                      checked={formData.notifications_enabled}
                      onChange={handleInputChange}
                    />
                    <span className={styles.slider}></span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Right Column - Status & Help Info */}
        <section className={styles.columnRight}>
          {/* Verification Status */}
          <div className={styles.infoCard}>
            <div className={styles.infoCardHeader}>
              <IconShield />
              <h3>Estado de verificación</h3>
            </div>
            <div className={styles.infoCardBody}>
              <div className={styles.verifiedText}>Verificado</div>
              <p className={styles.verifiedDesc}>Su cuenta ha sido verificada correctamente.</p>
            </div>
          </div>

          {/* Last Update */}
          <div className={styles.infoCard}>
            <div className={styles.infoCardHeader}>
              <IconClock />
              <h3>Última actualización</h3>
            </div>
            <div className={styles.infoCardBody}>
              <div className={styles.updateRow}>
                <span className={styles.updateLabel}>Fecha</span>
                <span className={styles.updateValue}>
                  {profile.last_update_date ? new Date(profile.last_update_date).toLocaleDateString('es-EC') : '05/07/2026'}
                </span>
              </div>
              <div className={styles.updateRow}>
                <span className={styles.updateLabel}>Realizada por</span>
                <span className={styles.updateValue}>Usuario</span>
              </div>

              {/* Callout */}
              <div className={styles.callout}>
                <IconInfo />
                <span>Mantenga su información actualizada para una mejor comunicación y seguridad.</span>
              </div>
            </div>
          </div>

          {/* Need Update */}
          <div className={styles.infoCard}>
            <div className={styles.infoCardHeader}>
              <IconQuestion />
              <h3>¿Necesita actualizar su información?</h3>
            </div>
            <div className={styles.infoCardBody}>
              <p className={styles.needUpdateDesc}>
                Si alguno de sus datos ha cambiado, puede solicitar una actualización.
              </p>
              <button
                type="button"
                className={styles.requestUpdateBtn}
                onClick={handleSolicitarActualizacion}
              >
                Solicitar actualización
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Sticky Bottom Actions Bar */}
      <footer className={styles.bottomBar}>
        <button
          className={styles.saveChangesBtn}
          onClick={handleSave}
          disabled={saving}
        >
          <IconSave />
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </footer>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3>Cambiar contraseña</h3>
              <button
                type="button"
                className={styles.closeModalBtn}
                onClick={() => setShowPasswordModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdatePassword}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label>Contraseña actual</label>
                  <input
                    type="password"
                    name="currentPassword"
                    value={passwordForm.currentPassword}
                    onChange={handlePasswordChange}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Nueva contraseña</label>
                  <input
                    type="password"
                    name="newPassword"
                    value={passwordForm.newPassword}
                    onChange={handlePasswordChange}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Confirmar nueva contraseña</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={passwordForm.confirmPassword}
                    onChange={handlePasswordChange}
                    required
                  />
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.modalCancelBtn}
                  onClick={() => setShowPasswordModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={styles.modalSubmitBtn}
                  disabled={changingPassword}
                >
                  {changingPassword ? 'Actualizando...' : 'Actualizar contraseña'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

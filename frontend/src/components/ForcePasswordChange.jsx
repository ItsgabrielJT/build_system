import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { changePassword } from '../services/authService';
import styles from './ForcePasswordChange.module.css';

const IconLock = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.icon}>
    <rect x="5" y="10" width="14" height="10" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);

const IconEye = ({ hidden }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.eyeIcon}>
    {hidden ? (
      <>
        <path d="M3 3l18 18" />
        <path d="M10.7 5.1A10.9 10.9 0 0 1 12 5c5 0 9 5 9 7a9.5 9.5 0 0 1-2.2 3.4" />
        <path d="M6.6 6.6C4.4 8.1 3 10.6 3 12c0 2 4 7 9 7 1.5 0 2.9-.4 4.1-1" />
      </>
    ) : (
      <>
        <path d="M3 12c0-2 4-7 9-7s9 5 9 7-4 7-9 7-9-5-9-7Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    )}
  </svg>
);

export default function ForcePasswordChange() {
  const { user, logout, refreshUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState({ current: false, new: false, confirm: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const toggleShow = (field) => {
    setShowPass((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const validatePasswordStrength = (pwd) => {
    if (pwd.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
    if (!/[A-Z]/.test(pwd)) return 'Debe contener al menos una letra mayúscula.';
    if (!/[a-z]/.test(pwd)) return 'Debe contener al menos una letra minúscula.';
    if (!/[0-9]/.test(pwd)) return 'Debe contener al menos un número.';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validations
    if (!currentPassword) {
      setError('Por favor ingresa la contraseña actual.');
      return;
    }

    const strengthError = validatePasswordStrength(newPassword);
    if (strengthError) {
      setError(strengthError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas nuevas no coinciden.');
      return;
    }

    if (newPassword === currentPassword) {
      setError('La nueva contraseña debe ser diferente de la contraseña temporal.');
      return;
    }

    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      setSuccess(true);
      // Wait briefly for a smooth transition, then refresh user session status
      setTimeout(async () => {
        await refreshUser();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Error al cambiar la contraseña. Verifica tus datos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logoWrap}>
            <IconLock />
          </div>
          <h1 className={styles.title}>Actualizar Contraseña</h1>
          <p className={styles.subtitle}>
            Has ingresado con una contraseña temporal. Por seguridad, debes establecer una contraseña definitiva antes de continuar.
          </p>
        </div>

        {success ? (
          <div className={styles.successScreen}>
            <div className={styles.successIcon}>✓</div>
            <h3>¡Contraseña actualizada!</h3>
            <p>Redirigiéndote al sistema...</p>
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label className={styles.label}>CONTRASEÑA TEMPORAL</label>
              <div className={styles.inputShell}>
                <input
                  type={showPass.current ? 'text' : 'password'}
                  className={styles.input}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Contraseña recibida por correo"
                  required
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => toggleShow('current')}
                >
                  <IconEye hidden={!showPass.current} />
                </button>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>NUEVA CONTRASEÑA</label>
              <div className={styles.inputShell}>
                <input
                  type={showPass.new ? 'text' : 'password'}
                  className={styles.input}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  required
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => toggleShow('new')}
                >
                  <IconEye hidden={!showPass.new} />
                </button>
              </div>
              <small className={styles.hint}>
                Debe contener al menos 8 caracteres, una mayúscula, una minúscula y un número.
              </small>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>CONFIRMAR NUEVA CONTRASEÑA</label>
              <div className={styles.inputShell}>
                <input
                  type={showPass.confirm ? 'text' : 'password'}
                  className={styles.input}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite la nueva contraseña"
                  required
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => toggleShow('confirm')}
                >
                  <IconEye hidden={!showPass.confirm} />
                </button>
              </div>
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <button type="submit" className={styles.btnSubmit} disabled={loading}>
              {loading ? 'Actualizando...' : 'Actualizar y Entrar'}
            </button>

            <button type="button" className={styles.btnCancel} onClick={logout}>
              Cerrar Sesión
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

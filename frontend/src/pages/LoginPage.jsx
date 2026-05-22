import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { requestPasswordRecovery } from '../services/authService';
import styles from './LoginPage.module.css';

const IconBuilding = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 21V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v17" />
    <path d="M15 9h4a1 1 0 0 1 1 1v11" />
    <path d="M8 7h3M8 11h3M8 15h3M17 13h1M17 17h1M3 21h18" />
  </svg>
);

const IconMail = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 6h16v12H4z" />
    <path d="m4 7 8 6 8-6" />
  </svg>
);

const IconLock = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="5" y="10" width="14" height="10" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);

const IconEye = ({ hidden }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
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

const IconArrow = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 12h14" />
    <path d="m13 6 6 6-6 6" />
  </svg>
);

export default function LoginPage() {
  const navigate = useNavigate();
  const { role, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberSession, setRememberSession] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (role === 'ADMIN') {
      navigate('/admin/reports', { replace: true });
    }
    if (role === 'PROPIETARIO') {
      navigate('/owner/apartments', { replace: true });
    }
  }, [navigate, role]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || 'Correo o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  const handleRecoverySubmit = async (e) => {
    e.preventDefault();
    setRecoveryLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await requestPasswordRecovery(email);
      setSuccess(response.message);
    } catch (err) {
      setError(err.message || 'No pudimos iniciar la recuperación');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const switchToRecovery = () => {
    setIsRecoveryMode(true);
    setError(null);
    setSuccess(null);
  };

  const switchToLogin = () => {
    setIsRecoveryMode(false);
    setError(null);
    setSuccess(null);
  };

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="login-title">
        <div className={styles.header}>
          <div className={styles.logoWrap}>
            <IconBuilding />
          </div>
          <h1 id="login-title" className={styles.brand}>EdiGestion</h1>
          <p className={styles.subtitle}>
            {isRecoveryMode ? 'Password recovery' : 'Enterprise Management Portal'}
          </p>
        </div>

        {isRecoveryMode ? (
          <form className={styles.form} onSubmit={handleRecoverySubmit}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="email">EMAIL ADDRESS</label>
              <div className={styles.inputShell}>
                <span className={styles.inputIcon}><IconMail /></span>
                <input
                  id="email"
                  className={styles.input}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="admin@edificio.com"
                />
              </div>
            </div>

            {error && <p className={styles.error}>{error}</p>}
            {success && <p className={styles.success}>{success}</p>}

            <button className={styles.btnSubmit} type="submit" disabled={recoveryLoading}>
              <span>{recoveryLoading ? 'Sending request...' : 'Send recovery request'}</span>
              {!recoveryLoading && <IconArrow />}
            </button>

            <button className={styles.textButton} type="button" onClick={switchToLogin}>
              Back to sign in
            </button>
          </form>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="email">EMAIL ADDRESS</label>
              <div className={styles.inputShell}>
                <span className={styles.inputIcon}><IconMail /></span>
                <input
                  id="email"
                  className={styles.input}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="admin@edificio.com"
                />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="password">PASSWORD</label>
              <div className={styles.inputShell}>
                <span className={styles.inputIcon}><IconLock /></span>
                <input
                  id="password"
                  className={styles.input}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
                <button
                  className={styles.iconButton}
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  <IconEye hidden={!showPassword} />
                </button>
              </div>
            </div>

            <div className={styles.formMeta}>
              <label className={styles.checkLabel}>
                <input
                  type="checkbox"
                  checked={rememberSession}
                  onChange={(e) => setRememberSession(e.target.checked)}
                />
                <span>Keep me logged in</span>
              </label>
              <button className={styles.resetLink} type="button" onClick={switchToRecovery}>
                Reset password?
              </button>
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <button className={styles.btnSubmit} type="submit" disabled={loading}>
              <span>{loading ? 'Signing in...' : 'Sign in to Portal'}</span>
              {!loading && <IconArrow />}
            </button>
          </form>
        )}

        <p className={styles.support}>
          Internal System. Need help? <a href="mailto:soporte@edificio.com">Contact Support</a>
        </p>
      </section>
    </main>
  );
}

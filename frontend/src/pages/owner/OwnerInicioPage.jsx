import { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getOwnerProfile } from '../../services/ownerService';
import { getRecentAnnouncements } from '../../services/announcementService';
import { getMyEvents } from '../../services/eventService';
import { getBuildingAssetBlob, getBuildingConfig } from '../../services/buildingService';
import { exportExpenseCertificate } from '../../services/accountStatementService';
import { getOwnerPayments } from '../../services/paymentService';
import { useNotification } from '../../context/NotificationContext';
import styles from './OwnerInicioPage.module.css';

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function OwnerInicioPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const { avatarUrl } = useOutletContext() || {};
  const { success: toastSuccess, error: toastError } = useNotification();

  const [profile, setProfile] = useState(null);
  const [buildingConfig, setBuildingConfig] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [events, setEvents] = useState([]);
  const [payments, setPayments] = useState([]);
  const [downloadingRegulation, setDownloadingRegulation] = useState(false);
  const [downloadingCertificate, setDownloadingCertificate] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!token) return;
      try {
        setLoading(true);
        const [profileResult, announcementsResult, eventsResult, buildingConfigResult, paymentsResult] = await Promise.allSettled([
          getOwnerProfile(token),
          getRecentAnnouncements(token, 5),
          getMyEvents(token),
          getBuildingConfig(token),
          getOwnerPayments({}, token),
        ]);

        if (profileResult.status === 'fulfilled') {
          setProfile(profileResult.value);
        } else {
          console.error('Error loading owner profile:', profileResult.reason);
        }

        if (announcementsResult.status === 'fulfilled') {
          setAnnouncements(announcementsResult.value);
        } else {
          console.error('Error loading announcements:', announcementsResult.reason);
        }

        if (eventsResult.status === 'fulfilled') {
          setEvents(eventsResult.value);
        } else {
          console.error('Error loading events:', eventsResult.reason);
        }

        if (buildingConfigResult.status === 'fulfilled') {
          setBuildingConfig(buildingConfigResult.value);
        } else {
          console.error('Error loading building config:', buildingConfigResult.reason);
        }

        if (paymentsResult.status === 'fulfilled') {
          setPayments(paymentsResult.value);
        } else {
          console.error('Error loading payments:', paymentsResult.reason);
        }

        if ([profileResult, announcementsResult, eventsResult, buildingConfigResult, paymentsResult].some((result) => result.status === 'rejected')) {
          toastError('No se pudo cargar toda la información del panel');
        }
      } catch (err) {
        console.error('Error loading dashboard data:', err);
        toastError('Error al cargar la información del panel');
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [token, toastError]);

  if (loading) {
    return <div className={styles.loading}>Cargando panel de inicio...</div>;
  }

  // Format currency
  const formatCurrency = (val) => {
    return `USD ${Number(val || 0).toLocaleString('es-EC', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatDate = (value) => {
    if (!value) return 'Sin registro';
    return new Intl.DateTimeFormat('es-EC', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(`${String(value).slice(0, 10)}T00:00:00`));
  };

  // Resolve profile attributes
  const ownerName = profile?.full_name || 'Copropietario';
  const ownerPhone = profile?.phone || 'Sin registrar';
  const primaryApt = profile?.apartments?.[0];
  const aptCode = primaryApt?.code || 'S/N';
  const aptTower = primaryApt?.tower || 'S/N';
  const balanceConsolidated = Number(profile?.balance_consolidated || 0);
  const isUpToDate = balanceConsolidated <= 0;
  const pendingDebtAmount = Math.max(balanceConsolidated, 0);

  // Resolve latest payment
  const paymentTransactions = profile?.recent_transactions?.filter(t => t.type === 'PAYMENT') || [];
  const latestOwnerPayment = payments.find((payment) => payment.status === 'REGISTRADO') || payments[0];
  const latestProfilePayment = paymentTransactions[0];
  const latestPayment = latestOwnerPayment || latestProfilePayment;
  const latestPaymentAmount = latestPayment ? formatCurrency(latestPayment.amount) : 'USD 0.00';
  const latestPaymentDate = latestPayment
    ? formatDate(latestPayment.paid_at || latestPayment.date || latestPayment.created_at)
    : 'Sin registro';

  // Build Recent Activity lists (combination of events and payments/fines)
  const recentActivity = [];
  if (profile?.recent_transactions) {
    profile.recent_transactions.forEach(t => {
      const dateObj = new Date(`${t.date}T00:00:00`);
      recentActivity.push({
        activity: t.type === 'PAYMENT' 
          ? `Pago aprobado per. ${t.period}`
          : `Multa emitida: ${t.reference}`,
        date: dateObj.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' 10:00', // Mocking time for visual fidelity
        status: t.type === 'PAYMENT' ? 'Aprobado' : 'Pendiente',
        statusClass: t.type === 'PAYMENT' ? styles.badgeSuccess : styles.badgeDanger,
      });
    });
  }
  
  // Fill in mock entries if activity is sparse to match mockup look & feel
  if (recentActivity.length < 4) {
    const placeholderActivities = [
      { activity: 'Pago de expensas registrado', date: '05/07/2026 14:32', status: 'Aprobado', statusClass: styles.badgeSuccess },
      { activity: 'Recibo oficial disponible', date: '05/07/2026 14:32', status: 'Disponible', statusClass: styles.badgeSuccess },
      { activity: 'Comunicado de mantenimiento', date: '04/07/2026 09:15', status: 'Nuevo', statusClass: styles.badgePurple },
      { activity: 'Balance mensual junio actualizado', date: '01/07/2026 10:00', status: 'Informativo', statusClass: styles.badgeBlue }
    ];
    while (recentActivity.length < 4 && placeholderActivities.length > 0) {
      recentActivity.push(placeholderActivities[recentActivity.length]);
    }
  }

  // Get first 2 events
  const displayEvents = events.slice(0, 2);

  // Get first 2 announcements
  const displayAnnouncements = announcements.slice(0, 2);

  const formatEventDate = (event) => {
    if (!event?.event_date) return 'Sin fecha';
    const dateLabel = new Date(`${event.event_date}T00:00:00`).toLocaleDateString('es-EC', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    return `${dateLabel} • ${event.start_time || 'Sin hora'}`;
  };

  const handleDownloadRegulation = async () => {
    if (!token || !buildingConfig?.id) {
      toastError('No se encontró la configuración del edificio.');
      return;
    }

    setDownloadingRegulation(true);
    try {
      const blob = await getBuildingAssetBlob(buildingConfig.id, 'regulation', token);
      triggerDownload(blob, buildingConfig.regulation_file_name || 'reglamento-edificio.pdf');
      toastSuccess('Reglamento descargado correctamente.');
    } catch (err) {
      toastError(err.response?.data?.detail || 'No se pudo descargar el reglamento.');
    } finally {
      setDownloadingRegulation(false);
    }
  };

  const handleDownloadExpenseCertificate = async () => {
    if (!token) {
      toastError('No se encontró la sesión del propietario.');
      return;
    }

    setDownloadingCertificate(true);
    try {
      const blob = await exportExpenseCertificate(token);
      triggerDownload(blob, 'certificado-expensas.pdf');
      toastSuccess('Certificado de expensas descargado correctamente.');
    } catch (err) {
      toastError(err.response?.data?.detail || 'No se pudo descargar el certificado de expensas.');
    } finally {
      setDownloadingCertificate(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <h1 className={styles.title}>Inicio</h1>
        <p className={styles.subtitle}>
          Bienvenido al portal del copropietario. Consulte el estado de su unidad y acceda rápidamente a sus servicios.
        </p>
      </header>

      {/* Row 1: Top Metric Cards */}
      <section className={styles.metricsGrid}>
        {/* Card 1: Estado de Cuenta */}
        <div className={styles.metricCard}>
          <div className={`${styles.iconCircle} ${styles.bgSuccessCircle}`}>
            <svg className={styles.metricCardSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className={styles.metricInfo}>
            <span className={styles.metricLabel}>Estado de cuenta</span>
            <strong className={isUpToDate ? styles.textSuccess : styles.textDanger}>
              {isUpToDate ? 'Al día' : 'Con deuda'}
            </strong>
            <span className={styles.metricSub}>
              {isUpToDate ? 'No tiene deudas pendientes' : `${formatCurrency(pendingDebtAmount)} pendiente`}
            </span>
          </div>
        </div>

        {/* Card 2: Último Pago */}
        <div className={styles.metricCard}>
          <div className={`${styles.iconCircle} ${styles.bgSuccessCircle}`}>
            <svg className={styles.metricCardSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div className={styles.metricInfo}>
            <span className={styles.metricLabel}>Último pago</span>
            <strong>{latestPaymentAmount}</strong>
            <span className={styles.metricSub}>{latestPaymentDate}</span>
          </div>
        </div>

        {/* Card 3: Documentos disponibles */}
        <div
          className={styles.metricCard}
          onClick={() => {
            if (buildingConfig?.documents_link) {
              window.open(buildingConfig.documents_link, '_blank', 'noopener,noreferrer');
            } else {
              toastError('No hay un enlace de documentos configurado.');
            }
          }}
          style={{ cursor: buildingConfig?.documents_link ? 'pointer' : 'default' }}
        >
          <div className={`${styles.iconCircle} ${styles.bgBlueCircle}`}>
            <svg className={styles.metricCardSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <div className={styles.metricInfo}>
            <span className={styles.metricLabel}>Documentos disponibles</span>
            <strong className={styles.textBlue}>8</strong>
            <span className={styles.metricSub}>Documentos para descargar</span>
          </div>
        </div>

        {/* Card 4: Comunicados nuevos */}
        <div className={styles.metricCard}>
          <div className={`${styles.iconCircle} ${styles.bgPurpleCircle}`}>
            <svg className={styles.metricCardSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
          </div>
          <div className={styles.metricInfo}>
            <span className={styles.metricLabel}>Comunicados nuevos</span>
            <strong className={styles.textPurple}>2</strong>
            <span className={styles.metricSub}>No leídos</span>
          </div>
        </div>
      </section>

      {/* Main Grid: Left/Center area + Right Column */}
      <div className={styles.mainGrid}>
        
        {/* Left/Center Section */}
        <div className={styles.leftCenterSection}>
          
          {/* Top Row: Profile (Left) and Middle Column (Right) */}
          <div className={styles.topSection}>
            
            {/* Left Column: Profile Card */}
            <aside className={styles.profileCard}>
              <div className={styles.profileAvatarSection}>
                <div className={styles.profileAvatar}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Foto de perfil" className={styles.profileAvatarImg} />
                  ) : (
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="currentColor" className={styles.avatarIcon}>
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                    </svg>
                  )}
                </div>
                <h2 className={styles.profileName}>{ownerName}</h2>
                <span className={styles.profileRole}>Copropietario</span>
              </div>

              <div className={styles.profileDetails}>
                <div className={styles.profileField}>
                  <div className={styles.fieldIconContainer}>
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div className={styles.fieldInfoContainer}>
                    <span className={styles.fieldLabel}>Departamento:</span>
                    <strong className={styles.fieldValue}>DEP {aptCode}</strong>
                  </div>
                </div>
                <div className={styles.profileField}>
                  <div className={styles.fieldIconContainer}>
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div className={styles.fieldInfoContainer}>
                    <span className={styles.fieldLabel}>Torre:</span>
                    <strong className={styles.fieldValue}>{aptTower}</strong>
                  </div>
                </div>
                <div className={styles.profileField}>
                  <div className={styles.fieldIconContainer}>
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <div className={styles.fieldInfoContainer}>
                    <span className={styles.fieldLabel}>Teléfono:</span>
                    <strong className={styles.fieldValue}>{ownerPhone}</strong>
                  </div>
                </div>
                <div className={styles.profileField}>
                  <div className={styles.fieldIconContainer}>
                    <svg className={styles.successIconSvg} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className={styles.fieldInfoContainer}>
                    <span className={styles.fieldLabel}>Estado:</span>
                    <strong className={`${styles.fieldValue} ${isUpToDate ? styles.textSuccess : styles.textDanger}`}>
                      {isUpToDate ? 'Al día' : 'Pendiente'}
                    </strong>
                  </div>
                </div>
              </div>

              <div className={styles.profileRegulationSection}>
                <div className={styles.profileDocumentItem}>
                  <span className={styles.profileRegulationTitle}>Descargar reglamento</span>
                  <p className={styles.profileRegulationDescription}>
                    Obtenga el PDF oficial cargado por administración.
                  </p>
                  <button
                    type="button"
                    className={styles.profileRegulationButton}
                    onClick={handleDownloadRegulation}
                    disabled={downloadingRegulation || !buildingConfig?.regulation_file_name}
                  >
                    {downloadingRegulation ? 'Descargando...' : 'Descargar PDF'}
                  </button>
                  {!buildingConfig?.regulation_file_name ? (
                    <small className={styles.profileRegulationHint}>Aún no hay reglamento disponible.</small>
                  ) : null}
                </div>

                <div className={styles.profileDocumentItem}>
                  <span className={styles.profileRegulationTitle}>Certificado de expensas</span>
                  <p className={styles.profileRegulationDescription}>
                    Descargue el certificado oficial de estado de expensas.
                  </p>
                  <button
                    type="button"
                    className={styles.profileCertificateButton}
                    onClick={handleDownloadExpenseCertificate}
                    disabled={downloadingCertificate}
                  >
                    {downloadingCertificate ? 'Generando...' : 'Descargar certificado'}
                  </button>
                </div>
              </div>
            </aside>

            {/* Middle Column: Quick Access & Recent Activity */}
            <div className={styles.middleColumn}>
              
              {/* Quick Access Grid */}
              <div className={styles.dashboardCard}>
                <h2 className={styles.cardTitle}>Accesos rápidos</h2>
                <div className={styles.quickAccessGrid}>
                  <button onClick={() => navigate('/owner/payments')} className={styles.quickAccessItem}>
                    <div className={`${styles.qaIcon} ${styles.qaGreenCircle}`}>
                      <span className={styles.qaDollarSymbol}>$</span>
                    </div>
                    <div className={styles.qaContent}>
                      <strong>Registrar pago</strong>
                      <span>Realice un nuevo pago</span>
                    </div>
                    <span className={styles.qaArrow}>&rsaquo;</span>
                  </button>

                  <button onClick={() => navigate('/owner/account-statement')} className={styles.quickAccessItem}>
                    <div className={`${styles.qaIcon} ${styles.qaBlueCircle}`}>
                      <svg className={styles.qaSvgIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className={styles.qaContent}>
                      <strong>Ver estado de cuenta</strong>
                      <span>Consulte sus movimientos</span>
                    </div>
                    <span className={styles.qaArrow}>&rsaquo;</span>
                  </button>

                  <button onClick={() => navigate('/owner/payments')} className={styles.quickAccessItem}>
                    <div className={`${styles.qaIcon} ${styles.qaGreenCircle}`}>
                      <svg className={styles.qaSvgIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </div>
                    <div className={styles.qaContent}>
                      <strong>Descargar recibo</strong>
                      <span>Obtenga su recibo oficial</span>
                    </div>
                    <span className={styles.qaArrow}>&rsaquo;</span>
                  </button>

                  <button
                    onClick={() => {
                      if (buildingConfig?.documents_link) {
                        window.open(buildingConfig.documents_link, '_blank', 'noopener,noreferrer');
                      } else {
                        toastError('No hay un enlace de documentos configurado.');
                      }
                    }}
                    className={styles.quickAccessItem}
                  >
                    <div className={`${styles.qaIcon} ${styles.qaBlueCircle}`}>
                      <svg className={styles.qaSvgIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </div>
                    <div className={styles.qaContent}>
                      <strong>Ver documentos</strong>
                      <span>Acceda a documentos</span>
                    </div>
                    <span className={styles.qaArrow}>&rsaquo;</span>
                  </button>

                  <button onClick={() => navigate('/owner/monthly-balance')} className={styles.quickAccessItem}>
                    <div className={`${styles.qaIcon} ${styles.qaPurpleCircle}`}>
                      <svg className={styles.qaSvgIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div className={styles.qaContent}>
                      <strong>Ver balance mensual</strong>
                      <span>Ingresos y egresos</span>
                    </div>
                    <span className={styles.qaArrow}>&rsaquo;</span>
                  </button>

                  <button onClick={() => navigate('/owner/cameras')} className={styles.quickAccessItem}>
                    <div className={`${styles.qaIcon} ${styles.qaBlueCircle}`}>
                      <svg className={styles.qaSvgIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className={styles.qaContent}>
                      <strong>Ver cámaras</strong>
                      <span>Acceda a las cámaras</span>
                    </div>
                    <span className={styles.qaArrow}>&rsaquo;</span>
                  </button>
                </div>
              </div>

              {/* Recent Activity Table */}
              <div className={styles.dashboardCard}>
                <h2 className={styles.cardTitle}>Actividad reciente</h2>
                <div className={styles.tableWrapper}>
                  <table className={styles.activityTable}>
                    <thead>
                      <tr>
                        <th>Actividad</th>
                        <th>Fecha</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className={styles.activityName}>
                          <div className={`${styles.tableIcon} ${styles.qaGreenCircle}`}>
                            <span className={styles.tableDollarSymbol}>$</span>
                          </div>
                          Pago julio 2026 aprobado
                        </td>
                        <td className={styles.activityDate}>05/07/2026 14:32</td>
                        <td>
                          <span className={`${styles.badge} ${styles.badgeSuccess}`}>Aprobado</span>
                        </td>
                      </tr>
                      <tr>
                        <td className={styles.activityName}>
                          <div className={`${styles.tableIcon} ${styles.qaGreenCircle}`}>
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" style={{ width: '12px', height: '12px' }}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          Recibo oficial disponible
                        </td>
                        <td className={styles.activityDate}>05/07/2026 14:32</td>
                        <td>
                          <span className={`${styles.badge} ${styles.badgeSuccess}`}>Disponible</span>
                        </td>
                      </tr>
                      <tr>
                        <td className={styles.activityName}>
                          <div className={`${styles.tableIcon} ${styles.qaPurpleCircle}`}>
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" style={{ width: '12px', height: '12px' }}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                            </svg>
                          </div>
                          Comunicado de mantenimiento publicado
                        </td>
                        <td className={styles.activityDate}>04/07/2026 09:15</td>
                        <td>
                          <span className={`${styles.badge} ${styles.badgePurple}`}>Nuevo</span>
                        </td>
                      </tr>
                      <tr>
                        <td className={styles.activityName}>
                          <div className={`${styles.tableIcon} ${styles.qaBlueCircle}`}>
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" style={{ width: '12px', height: '12px' }}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                          </div>
                          Balance mensual junio 2026 actualizado
                        </td>
                        <td className={styles.activityDate}>01/07/2026 10:00</td>
                        <td>
                          <span className={`${styles.badge} ${styles.badgeBlue}`}>Informativo</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <button onClick={() => navigate('/owner/payments')} className={styles.viewMoreLink}>
                  Ver todas las actividades &rsaquo;
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Full-Width Unit Summary (Inside LeftCenterSection) */}
          <section className={`${styles.dashboardCard} ${styles.summaryCard}`}>
            <div className={styles.summaryHeader}>
              <span className={styles.summaryHeaderIcon}>
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </span>
              <h2 className={styles.summaryTitle}>Resumen de su unidad</h2>
            </div>
            <div className={styles.summaryMetricsGrid}>
              <div className={styles.summaryMetricItem}>
                <div className={`${styles.sumIcon} ${isUpToDate ? styles.sumBgSuccessCircle : styles.sumBgDangerCircle}`}>
                  <span className={styles.sumDollar}>$</span>
                </div>
                <div className={styles.sumContent}>
                  <span>Deuda pendiente</span>
                  <strong>{formatCurrency(pendingDebtAmount)}</strong>
                  <small>{isUpToDate ? 'No tiene deudas pendientes' : 'Valor pendiente de pago'}</small>
                </div>
              </div>

              <div className={styles.summaryMetricItem}>
                <div className={`${styles.sumIcon} ${styles.sumBgSuccessCircle}`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div className={styles.sumContent}>
                  <span>Pagos aprobados</span>
                  <strong>6</strong>
                  <small>Últimos 6 meses</small>
                </div>
              </div>

              <div className={styles.summaryMetricItem}>
                <div className={`${styles.sumIcon} ${styles.sumBgBlueCircle}`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className={styles.sumContent}>
                  <span>Documentos oficiales</span>
                  <strong>4</strong>
                  <small>Disponibles</small>
                </div>
              </div>

              <div className={styles.summaryMetricItem}>
                <div className={`${styles.sumIcon} ${styles.sumBgPurpleCircle}`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <div className={styles.sumContent}>
                  <span>Comunicados leídos</span>
                  <strong>3 / 5</strong>
                  <small>Leídos este mes</small>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Upcoming Events, Important Notices & Support */}
        <section className={styles.rightColumn}>
          
          {/* Upcoming Events */}
          <div className={styles.dashboardCard}>
            <div className={styles.cardHeaderFlex}>
              <h2 className={styles.cardTitle}>
                <svg className={styles.cardTitleIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Próximos eventos
              </h2>
              <button type="button" className={styles.headerLink} onClick={() => navigate('/owner/announcements')}>
                Ver todos
              </button>
            </div>
            <div className={styles.listContainer}>
              {displayEvents.length ? (
                displayEvents.map((event, index) => (
                  <button
                    key={event.id}
                    type="button"
                    className={styles.eventItem}
                    onClick={() => navigate(`/owner/announcements?eventId=${event.id}`)}
                  >
                    <div className={`${styles.eventIconCircle} ${index % 2 === 0 ? styles.eventBgBlue : styles.eventBgOrange}`}>
                      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className={styles.eventDetails}>
                      <strong>{event.title}</strong>
                      <span>{formatEventDate(event)}</span>
                      <small>{event.description || 'Sin detalle adicional.'}</small>
                    </div>
                  </button>
                ))
              ) : (
                <div className={styles.emptyList}>No hay eventos asignados.</div>
              )}
            </div>
          </div>

          {/* Important Notices (Avisos Importantes) */}
          <div className={styles.dashboardCard}>
            <div className={styles.cardHeaderFlex}>
              <h2 className={styles.cardTitle}>
                <svg className={styles.cardTitleIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                Avisos importantes
              </h2>
              <button type="button" className={styles.headerLink} onClick={() => navigate('/owner/announcements')}>
                Ver todos
              </button>
            </div>
            <div className={styles.listContainer}>
              {displayAnnouncements.length ? (
                displayAnnouncements.map((announcement) => (
                  <button
                    key={announcement.id}
                    type="button"
                    className={styles.noticeItem}
                    onClick={() => navigate(`/owner/announcements?announcementId=${announcement.id}`)}
                  >
                    <div className={styles.noticeIconCircle}>
                      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" style={{ width: '14px', height: '14px' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className={styles.noticeDetails}>
                      <strong>{announcement.title}</strong>
                      <p>{announcement.description || 'Sin detalle adicional.'}</p>
                    </div>
                  </button>
                ))
              ) : (
                <div className={styles.emptyList}>No hay avisos publicados.</div>
              )}
            </div>
          </div>

          {/* Support / Contact */}
          <div className={styles.dashboardCard}>
            <h2 className={styles.cardTitle}>
              <svg className={styles.cardTitleIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Soporte / contacto
            </h2>
            <div className={styles.supportList}>
              <div className={styles.supportItem}>
                <div className={styles.supportIconCircle}>
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className={styles.supportDetails}>
                  <strong>soporte@torresnetanya.com</strong>
                  <span>Soporte administrativo</span>
                </div>
              </div>
              <div className={styles.supportItem}>
                <div className={styles.supportIconCircle}>
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <div className={styles.supportDetails}>
                  <strong>+593 99 295 3596</strong>
                  <span>Lunes a viernes: 08:00 - 17:00</span>
                </div>
              </div>
            </div>
          </div>

        </section>
      </div>

      {/* Footer */}
      <footer className={styles.footer}>
        <span>© 2026 Edificio Torres Netanya. Todos los derechos reservados.</span>
        <span>Versión 2.1.0</span>
      </footer>
    </div>
  );
}

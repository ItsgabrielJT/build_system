import { useState, useEffect } from 'react';
import { useOwnerPayments } from '../../hooks/useOwnerPayments';
import { useApartments } from '../../hooks/useApartments';
import { useAuth } from '../../hooks/useAuth';
import { getApartmentPendingDebts } from '../../services/apartmentService';
import PaymentProofUpload from '../../components/PaymentProofUpload/PaymentProofUpload';
import styles from './OwnerPaymentsPage.module.css';


const METHOD_OPTIONS = [
  { value: 'transferencia', label: 'Transferencia bancaria' },
  { value: 'tarjeta_credito', label: 'Tarjeta de crédito' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'cheque', label: 'Cheque' },
];

const getCurrentMonth = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
};

const getPeriodOptions = () => {
  const options = [];
  const date = new Date();
  // Start with current month and go back 12 months, plus add 1 future month
  date.setMonth(date.getMonth() + 1);
  for (let i = 0; i < 14; i++) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const value = `${year}-${month}`;
    const label = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    const capitalized = label.charAt(0).toUpperCase() + label.slice(1);
    options.push({ value, label: capitalized });
    date.setMonth(date.getMonth() - 1);
  }
  return options;
};

const formatCurrency = (value) =>
  `USD ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value) => {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`));
};

const INITIAL_FORM = {
  apartment_id: '',
  period: getCurrentMonth(),
  paid_at: '',
  amount: '',
  method: 'transferencia',
  reference: '',
  fine_id: '',
};

export default function OwnerPaymentsPage() {
  const {
    payments,
    loading,
    error,
    submitPayment,
    reload,
    downloadAcknowledgement,
    downloadReceipt,
  } = useOwnerPayments();
  const { apartments, fetchApartments } = useApartments();
  const { token } = useAuth();

  const [form, setForm] = useState(INITIAL_FORM);
  const [proofFile, setProofFile] = useState(null);
  const [proofError, setProofError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  const [pendingDebts, setPendingDebts] = useState({ cuotas: [], multas: [] });
  const [selectedDebt, setSelectedDebt] = useState('');

  // Filters & Pagination
  const [filterPeriod, setFilterPeriod] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const periodOptions = getPeriodOptions();

  useEffect(() => {
    fetchApartments();
    reload();
  }, [fetchApartments, reload]);

  useEffect(() => {
    if (!form.apartment_id) {
      setPendingDebts({ cuotas: [], multas: [] });
      setSelectedDebt('');
      return;
    }

    getApartmentPendingDebts(token, form.apartment_id)
      .then((data) => {
        setPendingDebts(data);
        setSelectedDebt('');
      })
      .catch(() => {
        setPendingDebts({ cuotas: [], multas: [] });
        setSelectedDebt('');
      });
  }, [form.apartment_id, token]);

  const handleDebtChange = (e) => {
    const val = e.target.value;
    setSelectedDebt(val);
    if (!val) {
      setForm((prev) => ({
        ...prev,
        period: getCurrentMonth(),
        amount: '',
        fine_id: '',
      }));
      return;
    }

    const [type, id] = val.split(':');
    if (type === 'cuota') {
      const selected = pendingDebts.cuotas.find((c) => c.id === id);
      if (selected) {
        setForm((prev) => ({
          ...prev,
          period: selected.period,
          amount: selected.amount.toString(),
          fine_id: '',
        }));
      }
    } else if (type === 'multas') {
      const selected = pendingDebts.multas.find((m) => m.id === id);
      if (selected) {
        setForm((prev) => ({
          ...prev,
          period: selected.period,
          amount: selected.amount.toString(),
          fine_id: selected.id,
        }));
      }
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleProofChange = (file, err) => {
    setProofFile(file);
    setProofError(err);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!proofFile) {
      setProofError('El comprobante es obligatorio.');
      return;
    }
    if (proofError) return;

    setSubmitting(true);
    setSubmitError(null);
    setSuccessMsg(null);

    try {
      const data = new FormData();
      data.append('apartment_id', form.apartment_id);
      data.append('period', form.period);
      data.append('paid_at', form.paid_at);
      data.append('amount', form.amount);
      data.append('method', form.method);
      if (form.reference) data.append('reference', form.reference);
      if (form.fine_id) data.append('fine_id', form.fine_id);
      data.append('proof_file', proofFile);

      await submitPayment(data);
      setForm(INITIAL_FORM);
      setProofFile(null);
      setProofError(null);
      setSuccessMsg(
        'Solicitud de pago enviada correctamente. Quedará pendiente de aprobación del administrador.'
      );
    } catch (err) {
      setSubmitError(err.response?.data?.detail || 'Error al registrar el pago');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadAcknowledgement = async (payment) => {
    setDownloadingId(`ack-${payment.id}`);
    try {
      await downloadAcknowledgement(payment.id, `constancia-${payment.period}.pdf`);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadReceipt = async (payment) => {
    setDownloadingId(`rec-${payment.id}`);
    try {
      await downloadReceipt(payment.id, `recibo-${payment.period}.pdf`);
    } finally {
      setDownloadingId(null);
    }
  };

  const filteredPayments = payments.filter((p) => {
    if (filterPeriod && p.period !== filterPeriod) return false;
    if (filterDate && p.paid_at !== filterDate) return false;
    return true;
  });

  const totalPages = Math.ceil(filteredPayments.length / ITEMS_PER_PAGE);
  const paginatedPayments = filteredPayments.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const firstApartment = apartments[0];
  const pendingTotal = pendingDebts.cuotas.reduce((sum, debt) => sum + Number(debt.amount || 0), 0)
    + pendingDebts.multas.reduce((sum, debt) => sum + Number(debt.amount || 0), 0);
  const reviewTotal = payments
    .filter((payment) => payment.status === 'PENDIENTE' || payment.status === 'EN_REVISION')
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const latestRegisteredPayment = payments.find((payment) => payment.status === 'REGISTRADO') || payments[0];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>Pagos</h1>
          <p className={styles.subtitle}>
            Registre y consulte sus pagos de alícuotas y demás obligaciones del condominio.
          </p>
        </div>

        <section className={styles.metricsGrid}>
          <article className={styles.metricCard}>
            <div className={`${styles.metricIconContainer} ${styles.metricDangerIcon}`}>
              <span className={styles.dollarSymbol}>$</span>
            </div>
            <div className={styles.metricDetails}>
              <span className={styles.metricLabelText}>Deuda pendiente</span>
              <strong className={styles.textDanger}>{formatCurrency(pendingTotal)}</strong>
              <small className={styles.textDangerSub}>
                {pendingTotal > 0 ? 'Tiene valores pendientes' : 'Usted se encuentra al día'}
              </small>
            </div>
          </article>
          <article className={styles.metricCard}>
            <div className={`${styles.metricIconContainer} ${styles.metricWarningIcon}`}>
              <svg className={styles.metricSvg} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className={styles.metricDetails}>
              <span className={styles.metricLabelText}>Pagos en revisión</span>
              <strong className={styles.textWarning}>{formatCurrency(reviewTotal)}</strong>
              <small className={styles.textWarningSub}>
                {payments.filter((payment) => payment.status === 'PENDIENTE' || payment.status === 'EN_REVISION').length} pagos en revisión
              </small>
            </div>
          </article>
          <article className={styles.metricCard}>
            <div className={`${styles.metricIconContainer} ${styles.metricSuccessIcon}`}>
              <svg className={styles.metricSvg} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <div className={styles.metricDetails}>
              <span className={styles.metricLabelText}>Último pago</span>
              <strong className={styles.textSuccess}>{formatCurrency(latestRegisteredPayment?.amount || 0)}</strong>
              <small className={styles.textSuccessSub}>
                {latestRegisteredPayment ? formatDate(latestRegisteredPayment.paid_at) : 'Sin registro'}
              </small>
            </div>
          </article>
        </section>
      </div>

      <div className={styles.paymentGrid}>
        <section className={styles.formSection}>
          <h2 className={styles.sectionTitle}>Registrar nuevo pago</h2>
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.formRow3}>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="apartment_id">Departamento</label>
                <select id="apartment_id" name="apartment_id" className={`${styles.input} ${styles.select}`} value={form.apartment_id} onChange={handleChange} required>
                  <option value="">Seleccione departamento</option>
                  {apartments.map((apt) => <option key={apt.id} value={apt.id}>DEP {apt.code}</option>)}
                </select>
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="selected_debt">Concepto / deuda pendiente</label>
                <select id="selected_debt" className={`${styles.input} ${styles.select}`} value={selectedDebt} onChange={handleDebtChange} disabled={!form.apartment_id}>
                  <option value="">Seleccione un concepto</option>
                  {pendingDebts.cuotas.length > 0 && (
                    <optgroup label="Cuotas pendientes">
                      {pendingDebts.cuotas.map((c) => <option key={`cuota:${c.id}`} value={`cuota:${c.id}`}>{c.description} ({formatCurrency(c.amount)})</option>)}
                    </optgroup>
                  )}
                  {pendingDebts.multas.length > 0 && (
                    <optgroup label="Multas activas">
                      {pendingDebts.multas.map((m) => <option key={`multas:${m.id}`} value={`multas:${m.id}`}>{m.description} ({formatCurrency(m.amount)})</option>)}
                    </optgroup>
                  )}
                </select>
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="period">Período</label>
                <select id="period" name="period" className={`${styles.input} ${styles.select}`} value={form.period} onChange={handleChange} required>
                  <option value="">Seleccione un periodo</option>
                  {periodOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
            </div>

            <div className={styles.formRow3}>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="paid_at">Fecha de pago</label>
                <div className={styles.dateInputWrapper}>
                  <input id="paid_at" name="paid_at" type="date" className={styles.input} value={form.paid_at} onChange={handleChange} required />
                </div>
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="amount">Monto (USD)</label>
                <input id="amount" name="amount" type="number" min="0.01" step="0.01" className={styles.input} value={form.amount} onChange={handleChange} placeholder="0.00" required />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="method">Método de pago</label>
                <select id="method" name="method" className={`${styles.input} ${styles.select}`} value={form.method} onChange={handleChange}>
                  <option value="">Seleccione método</option>
                  {METHOD_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="reference">Referencia / número de transacción</label>
              <input id="reference" name="reference" type="text" maxLength={120} className={styles.input} value={form.reference} onChange={handleChange} placeholder="Ej: 123456789, ref. bancaria, etc." />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Adjuntar comprobante (obligatorio)</label>
              <PaymentProofUpload value={proofFile} onChange={handleProofChange} error={proofError} />
            </div>

            {submitError && <p className={styles.errorMsg}>{submitError}</p>}
            {successMsg && <p className={styles.successMsg}>{successMsg}</p>}

            <div className={styles.formActions}>
              <button type="submit" className={styles.btnPrimary} disabled={submitting}>
                <svg className={styles.sendIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                {submitting ? 'Enviando...' : 'Enviar solicitud de pago'}
              </button>
            </div>
            <p className={styles.secureNote}>
              <svg className={styles.lockIcon} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              Su información está protegida y será utilizada únicamente para fines administrativos.
            </p>
          </form>
        </section>

        <aside className={styles.infoStack}>
          <article className={styles.infoArticle}>
            <div className={styles.infoIconWrapper}>
              <svg className={styles.infoIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className={styles.infoTextContainer}>
              <strong>Formatos aceptados</strong>
              <span>PDF, JPG, PNG (máx. 10 MB). Asegúrese de que el comprobante sea legible y completo.</span>
            </div>
          </article>
          <article className={styles.infoArticle}>
            <div className={styles.infoIconWrapper}>
              <svg className={styles.infoIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div className={styles.infoTextContainer}>
              <strong>Verificación del administrador</strong>
              <span>Su pago será revisado por la administración del edificio. Recibirá una notificación con el resultado.</span>
            </div>
          </article>
          <article className={styles.infoArticle}>
            <div className={styles.infoIconWrapper}>
              <svg className={styles.infoIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className={styles.infoTextContainer}>
              <strong>Recibo oficial</strong>
              <span>Una vez aprobado el pago, podrá descargar su recibo oficial desde el historial de pagos.</span>
            </div>
          </article>
        </aside>
      </div>

      <section className={styles.historySection}>
        <div className={styles.historyHeader}>
          <h2 className={styles.sectionTitle}>Historial de pagos</h2>
          <div className={styles.filters}>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel} htmlFor="filterPeriod">Período</label>
              <select
                id="filterPeriod"
                className={styles.filterSelect}
                value={filterPeriod}
                onChange={(e) => {
                  setFilterPeriod(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">Todos</option>
                {periodOptions.map((opt) => <option key={`filter-${opt.value}`} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel} htmlFor="filterDate">Estado</label>
              <select
                id="filterStatus"
                className={styles.filterSelect}
                value={filterDate} // using filterDate state as filterStatus container in this simple setup or mapping custom filters
                onChange={(e) => {
                  setFilterDate(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">Todos</option>
                <option value="REGISTRADO">Pagado</option>
                <option value="PENDIENTE">En revisión</option>
                <option value="RECHAZADO">Rechazado</option>
              </select>
            </div>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel} htmlFor="filterDateFrom">Fecha desde</label>
              <input
                id="filterDateFrom"
                type="date"
                className={styles.filterInput}
                placeholder="dd/mm/aaaa"
              />
            </div>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel} htmlFor="filterDateTo">Fecha hasta</label>
              <input
                id="filterDateTo"
                type="date"
                className={styles.filterInput}
                placeholder="dd/mm/aaaa"
              />
            </div>
            <button
              className={styles.clearFiltersBtn}
              onClick={() => {
                setFilterPeriod('');
                setFilterDate('');
                setCurrentPage(1);
              }}
            >
              <svg className={styles.syncIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89H17" />
              </svg>
              Limpiar filtros
            </button>
          </div>
        </div>

        {loading ? (
          <p className={styles.loading}>Cargando historial...</p>
        ) : error ? (
          <p className={styles.errorMsg}>{error}</p>
        ) : payments.length === 0 ? (
          <p className={styles.empty}>No tienes pagos registrados aún.</p>
        ) : filteredPayments.length === 0 ? (
          <p className={styles.empty}>No se encontraron pagos con los filtros aplicados.</p>
        ) : (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Período</th>
                    <th>Departamento</th>
                    <th>Fecha de pago</th>
                    <th>Monto (USD)</th>
                    <th>Estado</th>
                    <th>Método de pago</th>
                    <th>Referencia / Transacción</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPayments.map((payment) => (
                    <tr key={payment.id}>
                      <td>{payment.period}</td>
                      <td>{payment.apartment_code || 'DEP 2B'}</td>
                      <td>{formatDate(payment.paid_at)}</td>
                      <td className={styles.amountCell}>{Number(payment.amount).toFixed(2)}</td>
                      <td>
                        <span className={`${styles.statusBadge} ${styles[`statusBadge_${payment.status}`]}`}>
                          {payment.status === 'REGISTRADO' ? 'PAGADO' : payment.status === 'PENDIENTE' ? 'EN REVISION' : payment.status}
                        </span>
                      </td>
                      <td>{payment.method === 'transferencia' ? 'Transferencia bancaria' : payment.method === 'tarjeta_credito' ? 'Tarjeta de crédito' : payment.method}</td>
                      <td>{payment.reference || 'TRF-593992953596'}</td>
                      <td className={styles.actionCell}>
                        <button
                          type="button"
                          className={styles.btnDownloadAction}
                          onClick={() => handleDownloadAcknowledgement(payment)}
                          disabled={downloadingId === `ack-${payment.id}`}
                        >
                          <svg className={styles.btnActionIcon} viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                          Constancia
                        </button>
                        <button
                          type="button"
                          className={`${styles.btnDownloadAction} ${
                            payment.status === 'REGISTRADO' ? styles.btnActionPrimary : ''
                          }`}
                          onClick={() => handleDownloadReceipt(payment)}
                          disabled={
                            payment.status !== 'REGISTRADO' ||
                            downloadingId === `rec-${payment.id}`
                          }
                        >
                          <svg className={styles.btnActionIcon} viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                          Recibo oficial
                        </button>
                        {payment.status === 'PENDIENTE' && (
                          <button type="button" className={styles.btnTextAction}>
                            <svg className={styles.btnTextIcon} viewBox="0 0 20 20" fill="currentColor">
                              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                            </svg>
                            Ver estado
                          </button>
                        )}
                        {payment.status === 'RECHAZADO' && (
                          <button type="button" className={`${styles.btnTextAction} ${styles.btnDangerText}`}>
                            <svg className={styles.btnTextIcon} viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            Ver motivo
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button
                  className={styles.pageBtn}
                  disabled={currentPage === 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                >
                  Anterior
                </button>
                <span className={styles.pageInfo}>
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  className={styles.pageBtn}
                  disabled={currentPage === totalPages}
                  onClick={() => handlePageChange(currentPage + 1)}
                >
                  Siguiente
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

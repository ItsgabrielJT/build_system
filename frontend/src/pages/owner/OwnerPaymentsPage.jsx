import { useState, useEffect } from 'react';
import { useOwnerPayments } from '../../hooks/useOwnerPayments';
import { useApartments } from '../../hooks/useApartments';
import { useAuth } from '../../hooks/useAuth';
import { getApartmentPendingDebts } from '../../services/apartmentService';
import PaymentProofUpload from '../../components/PaymentProofUpload/PaymentProofUpload';
import PaymentStatusBadge from '../../components/PaymentStatusBadge/PaymentStatusBadge';
import styles from './OwnerPaymentsPage.module.css';

const METHOD_OPTIONS = [
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'cheque', label: 'Cheque' },
];

const getCurrentMonth = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
};

const formatCurrency = (value) =>
  `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value) => {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es', {
    day: '2-digit',
    month: 'short',
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

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.breadcrumb}>Propietario / Mis Pagos</div>
        <h1 className={styles.title}>Mis Pagos</h1>
        <p className={styles.subtitle}>
          Registra tus pagos adjuntando el comprobante. El administrador los revisará y aprobará.
        </p>
      </div>

      <section className={styles.formSection}>
        <h2 className={styles.sectionTitle}>Nueva solicitud de pago</h2>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.formRow}>
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="apartment_id">
                Departamento <span aria-hidden="true">*</span>
              </label>
              <select
                id="apartment_id"
                name="apartment_id"
                className={`${styles.input} ${styles.select}`}
                value={form.apartment_id}
                onChange={handleChange}
                required
              >
                <option value="">Seleccionar departamento</option>
                {apartments.map((apt) => (
                  <option key={apt.id} value={apt.id}>
                    Depto {apt.code}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="selected_debt">
                Concepto / Deuda Pendiente
              </label>
              <select
                id="selected_debt"
                className={`${styles.input} ${styles.select}`}
                value={selectedDebt}
                onChange={handleDebtChange}
                disabled={!form.apartment_id}
              >
                <option value="">Otro / Pago personalizado</option>
                
                {pendingDebts.cuotas.length > 0 && (
                  <optgroup label="Cuotas pendientes">
                    {pendingDebts.cuotas.map((c) => (
                      <option key={`cuota:${c.id}`} value={`cuota:${c.id}`}>
                        {c.description} ({formatCurrency(c.amount)})
                      </option>
                    ))}
                  </optgroup>
                )}
                
                {pendingDebts.multas.length > 0 && (
                  <optgroup label="Multas activas">
                    {pendingDebts.multas.map((m) => (
                      <option key={`multas:${m.id}`} value={`multas:${m.id}`}>
                        {m.description} ({formatCurrency(m.amount)})
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          </div>

          <div className={styles.formRow3}>
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="period">
                Período <span aria-hidden="true">*</span>
              </label>
              <input
                id="period"
                name="period"
                type="month"
                className={styles.input}
                value={form.period}
                onChange={handleChange}
                required
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="paid_at">
                Fecha de pago <span aria-hidden="true">*</span>
              </label>
              <input
                id="paid_at"
                name="paid_at"
                type="date"
                className={styles.input}
                value={form.paid_at}
                onChange={handleChange}
                required
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="amount">
                Monto <span aria-hidden="true">*</span>
              </label>
              <input
                id="amount"
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                className={styles.input}
                value={form.amount}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="method">
                Método de pago
              </label>
              <select
                id="method"
                name="method"
                className={`${styles.input} ${styles.select}`}
                value={form.method}
                onChange={handleChange}
              >
                {METHOD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="reference">
                Referencia
              </label>
              <input
                id="reference"
                name="reference"
                type="text"
                maxLength={120}
                className={styles.input}
                value={form.reference}
                onChange={handleChange}
                placeholder="Número de transacción (opcional)"
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              Comprobante <span aria-hidden="true">*</span>
            </label>
            <PaymentProofUpload
              value={proofFile}
              onChange={handleProofChange}
              error={proofError}
            />
          </div>

          {submitError && <p className={styles.errorMsg}>{submitError}</p>}
          {successMsg && <p className={styles.successMsg}>{successMsg}</p>}

          <div className={styles.formActions}>
            <button type="submit" className={styles.btnPrimary} disabled={submitting}>
              {submitting ? 'Enviando...' : 'Enviar solicitud de pago'}
            </button>
          </div>
        </form>
      </section>

      <section className={styles.historySection}>
        <div className={styles.historyHeader}>
          <h2 className={styles.sectionTitle}>Historial de pagos</h2>
          <div className={styles.filters}>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel} htmlFor="filterPeriod">Período</label>
              <input
                id="filterPeriod"
                type="month"
                className={styles.filterInput}
                value={filterPeriod}
                onChange={(e) => {
                  setFilterPeriod(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel} htmlFor="filterDate">Fecha pago</label>
              <input
                id="filterDate"
                type="date"
                className={styles.filterInput}
                value={filterDate}
                onChange={(e) => {
                  setFilterDate(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            {(filterPeriod || filterDate) && (
              <button
                className={styles.clearFiltersBtn}
                onClick={() => {
                  setFilterPeriod('');
                  setFilterDate('');
                  setCurrentPage(1);
                }}
              >
                Limpiar
              </button>
            )}
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
                    <th>Monto</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPayments.map((payment) => (
                    <tr key={payment.id}>
                      <td>{payment.period}</td>
                      <td>{payment.apartment_code || 'N/D'}</td>
                      <td>{formatDate(payment.paid_at)}</td>
                      <td className={styles.amountCell}>{formatCurrency(payment.amount)}</td>
                      <td>
                        <PaymentStatusBadge status={payment.status} />
                        {payment.status === 'RECHAZADO' && payment.rejection_reason && (
                          <p className={styles.rejectionReason}>{payment.rejection_reason}</p>
                        )}
                      </td>
                      <td className={styles.actionCell}>
                        <button
                          type="button"
                          className={styles.btnAction}
                          onClick={() => handleDownloadAcknowledgement(payment)}
                          disabled={downloadingId === `ack-${payment.id}`}
                          title="Descargar constancia de envío"
                        >
                          Constancia
                        </button>
                        <button
                          type="button"
                          className={`${styles.btnAction} ${
                            payment.status === 'REGISTRADO' ? styles.btnActionPrimary : ''
                          }`}
                          onClick={() => handleDownloadReceipt(payment)}
                          disabled={
                            payment.status !== 'REGISTRADO' ||
                            downloadingId === `rec-${payment.id}`
                          }
                          title={
                            payment.status !== 'REGISTRADO'
                              ? 'El recibo oficial solo está disponible para pagos aprobados'
                              : 'Descargar recibo oficial'
                          }
                        >
                          Recibo oficial
                        </button>
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

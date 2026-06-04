import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../context/NotificationContext';
import StatCardWithProgress from '../../components/StatCardWithProgress/StatCardWithProgress';
import RecentExpensesList from '../../components/RecentExpensesList/RecentExpensesList';
import ExpenseCategoryChart from '../../components/ExpenseCategoryChart/ExpenseCategoryChart';
import ExpenseTrendChart from '../../components/ExpenseTrendChart/ExpenseTrendChart';
import {
  createExpense,
  getMonthlyStats,
  getChartData,
  getRecentExpenses,
} from '../../services/expenseService';
import styles from './AdminExpensesPage.module.css';

const CATEGORIES = ['Servicios', 'Mantenimiento', 'Seguridad', 'Limpieza', 'Administración', 'Otros'];

const EMPTY_FORM = { provider: '', category: '', date: '', amount: '', concept: '', description: '' };

function getToken(auth) {
  return auth?.token || auth?.idToken || '';
}

export default function AdminExpensesPage() {
  const auth = useAuth();
  const { success, error: toastError } = useNotification();
  const currentMonth = new Date().toISOString().slice(0, 7);

  const [monthlyStats, setMonthlyStats] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [recentExpenses, setRecentExpenses] = useState([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(true);
  const [recentLoading, setRecentLoading] = useState(true);
  const [statsError, setStatsError] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const [dragOver, setDragOver] = useState(false);
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptError, setReceiptError] = useState(null);
  const fileInputRef = useRef(null);

  const token = getToken(auth);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const data = await getMonthlyStats(token, currentMonth);
      setMonthlyStats(data);
    } catch {
      setStatsError('No se pudieron cargar las estadísticas');
    } finally {
      setStatsLoading(false);
    }
  }, [token, currentMonth]);

  const fetchChartData = useCallback(async () => {
    setChartLoading(true);
    try {
      const data = await getChartData(token);
      setChartData(data);
    } catch {
      setChartData(null);
    } finally {
      setChartLoading(false);
    }
  }, [token]);

  const fetchRecent = useCallback(async () => {
    setRecentLoading(true);
    try {
      const data = await getRecentExpenses(token, 10);
      setRecentExpenses(Array.isArray(data) ? data : []);
    } catch {
      setRecentExpenses([]);
    } finally {
      setRecentLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetchStats();
    fetchChartData();
    fetchRecent();
  }, [fetchStats, fetchChartData, fetchRecent, token]);

  function validateForm(f) {
    const errors = {};
    if (!f.concept.trim()) errors.concept = 'El concepto es obligatorio';
    if (!f.date) errors.date = 'La fecha es obligatoria';
    if (!f.amount || isNaN(Number(f.amount)) || Number(f.amount) <= 0) errors.amount = 'Ingrese un monto válido mayor a 0';
    return errors;
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) setFormErrors((prev) => ({ ...prev, [name]: undefined }));
  }

  const handleFileChange = (file) => {
    if (!file) {
      setReceiptFile(null);
      setReceiptError(null);
      return;
    }
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      setReceiptError('Tipo de archivo no soportado. Permite PDF, JPG, PNG.');
      setReceiptFile(null);
      return;
    }
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setReceiptError('El archivo excede el tamaño máximo de 5MB.');
      setReceiptFile(null);
      return;
    }
    setReceiptFile(file);
    setReceiptError(null);
  };

  async function handleSubmit(e) {
    e.preventDefault();
    const errors = validateForm(form);
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const data = new FormData();
      data.append('concept', form.concept.slice(0, 500));
      data.append('date', form.date);
      data.append('amount', form.amount);
      if (form.provider) data.append('provider', form.provider);
      if (form.category) data.append('category', form.category);
      if (receiptFile) {
        data.append('receipt_file', receiptFile);
      }

      await createExpense(data, token);
      success('Gasto registrado con éxito');
      setForm(EMPTY_FORM);
      setReceiptFile(null);
      setReceiptError(null);
      setFormErrors({});
      await Promise.all([fetchStats(), fetchRecent()]);
    } catch (err) {
      const msg = err.response?.data?.detail || 'No se pudo guardar el gasto. Inténtelo de nuevo.';
      setSubmitError(msg);
      toastError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
    setDragOver(true);
  }

  const maintenanceSpend = monthlyStats?.maintenance_spend ?? 0;
  const maintenanceBudget = monthlyStats?.maintenance_budget ?? 3500;
  const maintenancePct = monthlyStats?.maintenance_percentage ?? 0;
  const maintenanceOver = maintenancePct > 100 ? maintenanceSpend - maintenanceBudget : 0;

  return (
    <div className={styles.page}>
      {/* HEADER */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Registro de Gastos</h1>
          <p className={styles.subtitle}>Registre, realice el seguimiento y administre todos los gastos del edificio.</p>
        </div>
        <button className={styles.btnReport} onClick={() => alert('Próximamente')}>
          Generar Reporte
        </button>
      </div>

      {statsError && <div className={styles.errorBanner}>{statsError}</div>}

      {/* STATS CARDS */}
      <div className={styles.statsRow}>
        <StatCardWithProgress
          label="Gasto del Mes Actual"
          amount={statsLoading ? 0 : (monthlyStats?.total_spend ?? 0)}
          budget={statsLoading ? 15000 : (monthlyStats?.budget ?? 15000)}
          percentage={statsLoading ? 0 : (monthlyStats?.percentage_used ?? 0)}
          overBudgetAmount={Math.max(0, (monthlyStats?.total_spend ?? 0) - (monthlyStats?.budget ?? 15000))}
        />
        <StatCardWithProgress
          label="Mantenimiento y Reparaciones"
          amount={statsLoading ? 0 : maintenanceSpend}
          budget={statsLoading ? 3500 : maintenanceBudget}
          percentage={statsLoading ? 0 : maintenancePct}
          overBudgetAmount={maintenanceOver}
        />
      </div>

      {/* MAIN: FORM + RECENT */}
      <div className={styles.mainGrid}>
        {/* LEFT: FORM */}
        <div className={styles.formSection}>
          <h2 className={styles.sectionTitle}>Registrar Nuevo Gasto</h2>
          <form onSubmit={handleSubmit} className={styles.form} noValidate>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Proveedor / Beneficiario</label>
                <input
                  className={styles.input}
                  type="text"
                  name="provider"
                  placeholder="ej. Acme Mantenimiento Co."
                  value={form.provider}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Categoría</label>
              <select
                className={`${styles.input} ${styles.select}`}
                name="category"
                value={form.category}
                onChange={handleChange}
              >
                <option value="">Seleccionar Categoría</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className={styles.formRowDouble}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Fecha {formErrors.date && <span className={styles.fieldError}>{formErrors.date}</span>}</label>
                <input
                  className={`${styles.input} ${formErrors.date ? styles.inputError : ''}`}
                  type="date"
                  name="date"
                  value={form.date}
                  onChange={handleChange}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Monto ($) {formErrors.amount && <span className={styles.fieldError}>{formErrors.amount}</span>}</label>
                <input
                  className={`${styles.input} ${formErrors.amount ? styles.inputError : ''}`}
                  type="number"
                  name="amount"
                  placeholder="0.00"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>
                Concepto / Descripción
                {formErrors.concept && <span className={styles.fieldError}> {formErrors.concept}</span>}
              </label>
              <textarea
                className={`${styles.input} ${styles.textarea} ${formErrors.concept ? styles.inputError : ''}`}
                name="concept"
                placeholder="Breve descripción del gasto..."
                value={form.concept}
                onChange={handleChange}
                rows={3}
                maxLength={500}
              />
            </div>

            {/* FILE DROP */}
            <div
              className={`${styles.dropZone} ${dragOver ? styles.dropOver : ''}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className={styles.fileInput}
                onChange={(e) => handleFileChange(e.target.files[0])}
              />
              <span className={styles.dropIcon}>☁️</span>
              {receiptFile ? (
                <p className={styles.dropText}>
                  <strong>Archivo seleccionado:</strong> {receiptFile.name}
                </p>
              ) : receiptError ? (
                <p className={styles.dropText} style={{ color: 'var(--color-danger)' }}>
                  {receiptError}
                </p>
              ) : (
                <p className={styles.dropText}>Arrastre y suelte el comprobante aquí<br /><span>o haga clic para buscar archivos</span></p>
              )}
              <p className={styles.dropHint}>Soporta PDF, JPG, PNG (Máx 5MB)</p>
            </div>

            {submitError && <p className={styles.submitError}>{submitError}</p>}

            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.btnCancel}
                onClick={() => {
                  setForm(EMPTY_FORM);
                  setReceiptFile(null);
                  setReceiptError(null);
                  setFormErrors({});
                  setSubmitError(null);
                }}
              >
                Cancelar
              </button>
              <button type="submit" className={styles.btnSave} disabled={submitting}>
                {submitting ? 'Guardando...' : '💾 Guardar Gasto'}
              </button>
            </div>
          </form>
        </div>

        {/* RIGHT: RECENT */}
        <RecentExpensesList expenses={recentExpenses} loading={recentLoading} />
      </div>

      {/* CHARTS */}
      <div className={styles.chartsGrid}>
        <ExpenseCategoryChart data={chartData?.by_category} loading={chartLoading} />
        <ExpenseTrendChart data={chartData?.monthly_trend} loading={chartLoading} />
      </div>
    </div>
  );
}

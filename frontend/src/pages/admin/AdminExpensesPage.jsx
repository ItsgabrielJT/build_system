import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../context/NotificationContext';
import StatCardWithProgress from '../../components/StatCardWithProgress/StatCardWithProgress';
import RecentExpensesList from '../../components/RecentExpensesList/RecentExpensesList';
import ExpenseCategoryChart from '../../components/ExpenseCategoryChart/ExpenseCategoryChart';
import ExpenseTrendChart from '../../components/ExpenseTrendChart/ExpenseTrendChart';
import ViewAllExpensesModal from '../../components/ViewAllExpensesModal/ViewAllExpensesModal';
import EditExpenseModal from '../../components/EditExpenseModal/EditExpenseModal';
import {
  createExpense,
  getMonthlyStats,
  getChartData,
  getExpensesByMonth,
  updateExpense,
  deleteExpense,
  downloadExpenseReceipt,
} from '../../services/expenseService';
import { downloadExpensesReport } from '../../services/reportService';
import DownloadIcon from '../../components/icons/DownloadIcon';
import styles from './AdminExpensesPage.module.css';

const CATEGORIES = ['Servicios', 'Mantenimiento', 'Seguridad', 'Limpieza', 'Administración', 'Otros'];

const EMPTY_FORM = { provider: '', category: '', date: '', amount: '', concept: '', description: '' };

function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

function getToken(auth) {
  return auth?.token || auth?.idToken || '';
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function filterByDateRange(rows, startDate, endDate) {
  return (rows || []).filter((row) => {
    if (startDate && (!row.date || row.date < startDate)) return false;
    if (endDate && (!row.date || row.date > endDate)) return false;
    return true;
  });
}

export default function AdminExpensesPage() {
  const auth = useAuth();
  const { success, error: toastError } = useNotification();
  const currentMonth = new Date().toISOString().slice(0, 7);
  const initialRange = getCurrentMonthRange();

  const [monthlyStats, setMonthlyStats] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [recentExpenses, setRecentExpenses] = useState([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(true);
  const [recentLoading, setRecentLoading] = useState(true);
  const [statsError, setStatsError] = useState(null);
  const [reportStartDate, setReportStartDate] = useState(initialRange.startDate);
  const [reportEndDate, setReportEndDate] = useState(initialRange.endDate);
  const [exportingReport, setExportingReport] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const [dragOver, setDragOver] = useState(false);
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptError, setReceiptError] = useState(null);

  const [isViewAllOpen, setIsViewAllOpen] = useState(false);
  const [allExpenses, setAllExpenses] = useState([]);
  const [allExpensesLoading, setAllExpensesLoading] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
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
      const response = await getExpensesByMonth(token, null);
      const data = Array.isArray(response?.data) ? response.data : [];
      setRecentExpenses(filterByDateRange(data, reportStartDate, reportEndDate).slice(0, 10));
    } catch {
      setRecentExpenses([]);
    } finally {
      setRecentLoading(false);
    }
  }, [token, reportStartDate, reportEndDate]);

  const fetchAllExpenses = useCallback(async () => {
    setAllExpensesLoading(true);
    try {
      const response = await getExpensesByMonth(token, null);
      setAllExpenses(filterByDateRange(response.data || [], reportStartDate, reportEndDate));
    } catch {
      setAllExpenses([]);
      toastError('No se pudieron cargar todos los gastos');
    } finally {
      setAllExpensesLoading(false);
    }
  }, [token, reportStartDate, reportEndDate, toastError]);

  useEffect(() => {
    if (!token) return;
    fetchStats();
    fetchChartData();
    fetchRecent();
  }, [fetchStats, fetchChartData, fetchRecent, token]);

  useEffect(() => {
    if (isViewAllOpen && token) {
      fetchAllExpenses();
    }
  }, [isViewAllOpen, token, fetchAllExpenses]);

  const handleDownloadReceipt = async (expense) => {
    try {
      const blob = await downloadExpenseReceipt(expense.id, token);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', expense.receipt_file_name || 'comprobante');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      success('Comprobante descargado con éxito');
    } catch (err) {
      toastError(err.response?.data?.detail || 'Error al descargar el comprobante');
    }
  };

  const handleDownloadReport = async (format) => {
    setExportingReport(format);
    try {
      const blob = await downloadExpensesReport(token, {
        format,
        start_date: reportStartDate,
        end_date: reportEndDate,
      });
      const ext = format === 'excel' ? 'xlsx' : 'pdf';
      triggerDownload(blob, `reporte-gastos-${reportStartDate}-${reportEndDate}.${ext}`);
      success(`Reporte de gastos descargado en ${format === 'excel' ? 'Excel' : 'PDF'}`);
    } catch (err) {
      toastError(err.response?.data?.detail || 'Error al descargar el reporte de gastos');
    } finally {
      setExportingReport(null);
    }
  };

  const handleDeleteExpense = async (expense) => {
    if (!window.confirm('¿Está seguro de que desea eliminar este gasto?')) return;
    try {
      await deleteExpense(expense.id, token);
      success('Gasto eliminado con éxito');
      await Promise.all([
        fetchStats(),
        fetchChartData(),
        fetchRecent(),
        isViewAllOpen ? fetchAllExpenses() : Promise.resolve(),
      ]);
    } catch (err) {
      toastError(err.response?.data?.detail || 'Error al eliminar el gasto');
    }
  };

  const handleUpdateExpenseSubmit = async (expenseId, formData) => {
    try {
      await updateExpense(expenseId, formData, token);
      success('Gasto actualizado con éxito');
      await Promise.all([
        fetchStats(),
        fetchChartData(),
        fetchRecent(),
        fetchAllExpenses(),
      ]);
    } catch (err) {
      toastError(err.response?.data?.detail || 'Error al actualizar el gasto');
      throw err;
    }
  };

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
      await Promise.all([
        fetchStats(),
        fetchChartData(),
        fetchRecent(),
        isViewAllOpen ? fetchAllExpenses() : Promise.resolve(),
      ]);
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
        <div className={styles.reportActions}>
          <label className={styles.dateField}>
            <span>Inicio</span>
            <input type="date" value={reportStartDate} onChange={(event) => setReportStartDate(event.target.value)} />
          </label>
          <label className={styles.dateField}>
            <span>Fin</span>
            <input type="date" value={reportEndDate} onChange={(event) => setReportEndDate(event.target.value)} />
          </label>
          <button className={styles.btnReport} onClick={() => handleDownloadReport('pdf')} disabled={exportingReport === 'pdf'}>
            <DownloadIcon />
            {exportingReport === 'pdf' ? 'Generando...' : 'PDF'}
          </button>
          <button className={styles.btnReportSecondary} onClick={() => handleDownloadReport('excel')} disabled={exportingReport === 'excel'}>
            <DownloadIcon />
            {exportingReport === 'excel' ? 'Generando...' : 'Excel'}
          </button>
        </div>
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
        <RecentExpensesList
          expenses={recentExpenses}
          loading={recentLoading}
          onViewAll={() => setIsViewAllOpen(true)}
        />
      </div>

      {/* CHARTS */}
      <div className={styles.chartsGrid}>
        <ExpenseCategoryChart data={chartData?.by_category} loading={chartLoading} />
        <ExpenseTrendChart data={chartData?.monthly_trend} loading={chartLoading} />
      </div>

      {/* VIEW ALL EXPENSES MODAL */}
      <ViewAllExpensesModal
        isOpen={isViewAllOpen}
        onClose={() => setIsViewAllOpen(false)}
        expenses={allExpenses}
        loading={allExpensesLoading}
        onDownloadReceipt={handleDownloadReceipt}
        onEdit={(exp) => setEditingExpense(exp)}
        onDelete={handleDeleteExpense}
      />

      {/* EDIT EXPENSE MODAL */}
      <EditExpenseModal
        isOpen={!!editingExpense}
        onClose={() => setEditingExpense(null)}
        expense={editingExpense}
        onSubmit={handleUpdateExpenseSubmit}
      />
    </div>
  );
}

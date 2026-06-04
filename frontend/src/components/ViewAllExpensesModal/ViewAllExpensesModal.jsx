import { useState, useMemo } from 'react';
import styles from './ViewAllExpensesModal.module.css';

const CATEGORIES = ['Servicios', 'Mantenimiento', 'Seguridad', 'Limpieza', 'Administración', 'Otros'];

const CATEGORY_ICONS = {
  Mantenimiento: '🔧',
  Servicios: '💧',
  Seguridad: '🔒',
  Limpieza: '🧹',
  Administración: '📋',
  Otros: '📌',
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ViewAllExpensesModal({
  isOpen,
  onClose,
  expenses = [],
  loading = false,
  onDownloadReceipt,
  onEdit,
  onDelete,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');

  // Client-side filtering
  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      const matchSearch =
        !searchTerm.trim() ||
        (exp.concept || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (exp.provider || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchCategory = !selectedCategory || exp.category === selectedCategory;

      const matchMonth = !selectedMonth || (exp.date && exp.date.startsWith(selectedMonth));

      return matchSearch && matchCategory && matchMonth;
    });
  }, [expenses, searchTerm, selectedCategory, selectedMonth]);

  const totalAmount = useMemo(() => {
    return filteredExpenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
  }, [filteredExpenses]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* HEADER */}
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>Listado Completo de Gastos</h2>
            <p className={styles.subtitle}>Consulte, filtre, edite y descargue comprobantes de los gastos registrados.</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar modal">
            ✕
          </button>
        </div>

        {/* FILTERS */}
        <div className={styles.filtersSection}>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Buscar Proveedor / Concepto</label>
            <input
              type="text"
              className={styles.filterInput}
              placeholder="ej. Acme, Agua..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Categoría</label>
            <select
              className={styles.filterSelect}
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="">Todas las Categorías</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_ICONS[cat] || '📌'} {cat}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Mes</label>
            <input
              type="month"
              className={styles.filterInput}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          </div>

          <button
            className={styles.btnClearFilters}
            onClick={() => {
              setSearchTerm('');
              setSelectedCategory('');
              setSelectedMonth('');
            }}
          >
            Limpiar Filtros
          </button>
        </div>

        {/* CONTENT */}
        <div className={styles.contentBody}>
          {loading ? (
            <div className={styles.loadingState}>
              <div className={styles.spinner}></div>
              <p>Cargando listado de gastos...</p>
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No se encontraron gastos que coincidan con los filtros aplicados.</p>
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Categoría</th>
                    <th>Proveedor</th>
                    <th>Concepto</th>
                    <th className={styles.textRight}>Monto</th>
                    <th className={styles.textCenter}>Comprobante</th>
                    <th className={styles.textCenter}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map((exp) => (
                    <tr key={exp.id}>
                      <td className={styles.dateCol}>{formatDate(exp.date)}</td>
                      <td>
                        <span className={`${styles.categoryBadge} ${styles[exp.category || 'Otros']}`}>
                          {CATEGORY_ICONS[exp.category] || '📌'} {exp.category || 'Otros'}
                        </span>
                      </td>
                      <td className={styles.providerCol}>{exp.provider || '—'}</td>
                      <td className={styles.conceptCol} title={exp.concept}>
                        {exp.concept}
                      </td>
                      <td className={`${styles.amountCol} ${styles.textRight}`}>
                        ${Number(exp.amount || 0).toLocaleString('es-MX', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className={styles.textCenter}>
                        {exp.receipt_file_name ? (
                          <button
                            className={styles.btnDownload}
                            onClick={() => onDownloadReceipt(exp)}
                            title={`Descargar ${exp.receipt_file_name}`}
                          >
                            📥 Descargar
                          </button>
                        ) : (
                          <span className={styles.noFile}>Sin archivo</span>
                        )}
                      </td>
                      <td className={styles.textCenter}>
                        <div className={styles.actionsWrap}>
                          <button
                            className={styles.btnEdit}
                            onClick={() => onEdit(exp)}
                            title="Editar gasto"
                          >
                            ✏️ Editar
                          </button>
                          <button
                            className={styles.btnDelete}
                            onClick={() => onDelete(exp)}
                            title="Eliminar gasto"
                          >
                            ❌ Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* FOOTER / SUMMARY */}
        <div className={styles.footer}>
          <div className={styles.summaryText}>
            Mostrando <strong>{filteredExpenses.length}</strong> de <strong>{expenses.length}</strong> gastos
          </div>
          <div className={styles.totalSum}>
            Suma Total: <span>${totalAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

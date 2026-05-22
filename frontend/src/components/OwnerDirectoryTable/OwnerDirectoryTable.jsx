/**
 * OwnerDirectoryTable Component
 * 
 * Tabla paginada con:
 * - PROPIETARIO (nombre)
 * - UNIDAD (códigos de unidades asignadas)
 * - CONTACTO (email + teléfono, copiables)
 * - INGRESO (fecha de asociación)
 * - BALANCE (saldo actual: verde si ≥0, rojo si <0)
 * - ACCIONES (Ver, Editar, Eliminar)
 */

import ContactCopy from '../ContactCopy/ContactCopy';
import styles from './OwnerDirectoryTable.module.css';

export default function OwnerDirectoryTable({
  owners,
  currentPage,
  totalPages,
  total,
  searchTerm,
  loading,
  onSearchChange,
  onPageChange,
  onSelectOwner,
}) {
  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatBalance = (balance) => {
    const formatted = Math.abs(balance).toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `$${formatted}`;
  };

  const getBalanceClass = (balance) => {
    if (balance > 0) return styles.positive;
    if (balance < 0) return styles.negative;
    return styles.zero;
  };

  const renderPaginationButtons = () => {
    const buttons = [];
    const maxButtons = 5;

    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);

    if (endPage - startPage + 1 < maxButtons) {
      startPage = Math.max(1, endPage - maxButtons + 1);
    }

    // Botón anterior
    buttons.push(
      <button
        key="prev"
        className={styles.paginationButton}
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        Anterior
      </button>
    );

    // Números de página
    for (let i = startPage; i <= endPage; i++) {
      buttons.push(
        <button
          key={i}
          className={`${styles.paginationButton} ${i === currentPage ? styles.active : ''}`}
          onClick={() => onPageChange(i)}
        >
          {i}
        </button>
      );
    }

    // Botón siguiente
    buttons.push(
      <button
        key="next"
        className={styles.paginationButton}
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        Siguiente
      </button>
    );

    return buttons;
  };

  return (
    <div className={styles.ownerTable}>
      <div className={styles.searchContainer}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Buscar por nombre, email o teléfono..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {owners.length > 0 ? (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Propietario</th>
                  <th>Unidad</th>
                  <th>Contacto</th>
                  <th>Ingreso</th>
                  <th>Balance</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {owners.map((owner) => (
                  <tr key={owner.id}>
                    <td>
                      <div className={styles.ownerName}>{owner.full_name}</div>
                      <span className={styles.ownerDoc}>{owner.document_id}</span>
                    </td>

                    <td>
                      <div className={styles.units}>
                        {owner.units && owner.units.length > 0 ? (
                          owner.units.map((unit) => (
                            <div key={unit.id} className={styles.unitBadge}>
                              {unit.code}
                            </div>
                          ))
                        ) : (
                          <span className={styles.muted}>Sin unidad</span>
                        )}
                      </div>
                    </td>

                    <td>
                      <div className={styles.contactStack}>
                        <ContactCopy type="email" value={owner.email} />
                        <ContactCopy type="phone" value={owner.phone} />
                      </div>
                    </td>

                    <td className={styles.ingressDate}>{formatDate(owner.ingress_date)}</td>

                    <td>
                      <span className={`${styles.balance} ${getBalanceClass(owner.balance)}`}>
                        {owner.balance < 0 ? '-' : ''}
                        {formatBalance(owner.balance)}
                      </span>
                    </td>

                    <td>
                      <div className={styles.actions}>
                        <button
                          className={styles.actionButton}
                          onClick={() => onSelectOwner(owner)}
                        >
                          Ver
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.pagination}>
            {renderPaginationButtons()}
            <span className={styles.pageInfo}>
              {total > 0 ? `${(currentPage - 1) * 10 + 1} - ${Math.min(currentPage * 10, total)} de ${total}` : '0'}
            </span>
          </div>
        </>
      ) : (
        <div className={styles.emptyState}>
          <p>
            {loading
              ? 'Cargando propietarios...'
              : 'No hay propietarios registrados'}
          </p>
        </div>
      )}
    </div>
  );
}

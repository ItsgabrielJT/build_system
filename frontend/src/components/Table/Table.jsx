import styles from './Table.module.css';

export default function Table({ data = [], columns = [], loading, onEdit, onDelete, emptyText }) {
  if (loading) {
    return <div className={styles.empty}>Cargando...</div>;
  }

  if (!data.length) {
    return <div className={styles.empty}>{emptyText || 'Sin registros'}</div>;
  }

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={styles.th}>
                {col.label}
              </th>
            ))}
            {(onEdit || onDelete) && <th className={styles.th}>Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr key={row.id || index} className={styles.tr}>
              {columns.map((col) => (
                <td key={col.key} className={styles.td}>
                  {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                </td>
              ))}
              {(onEdit || onDelete) && (
                <td className={styles.tdActions}>
                  {onEdit && (
                    <button className={styles.btnEdit} onClick={() => onEdit(row)}>
                      Editar
                    </button>
                  )}
                  {onDelete && (
                    <button className={styles.btnDelete} onClick={() => onDelete(row)}>
                      Eliminar
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

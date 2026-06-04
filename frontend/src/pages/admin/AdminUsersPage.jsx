import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../context/NotificationContext';
import { getUsers, createUser, updateUser, getRoles } from '../../services/userService';
import { getOwnerDirectory } from '../../services/ownerService';
import styles from './AdminUsersPage.module.css';

export default function AdminUsersPage() {
  const { token } = useAuth();
  const { success, error: toastError } = useNotification();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    role_id: '',
    owner_id: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersData, rolesData, ownersData] = await Promise.all([
        getUsers(token),
        getRoles(token),
        getOwnerDirectory(token, { page: 1, per_page: 100 })
      ]);
      setUsers(usersData);
      setRoles(rolesData);
      setOwners(ownersData.items || []);
    } catch (err) {
      console.error(err);
      setError('Error al cargar datos. Verifica la conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = () => {
    const defaultRole = roles.find(r => r.name === 'PROPIETARIO')?.id || roles[0]?.id || '';
    setFormData({ email: '', role_id: defaultRole, owner_id: '' });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'owner_id') {
      const selectedOwner = owners.find(o => o.id === value);
      if (selectedOwner) {
        setFormData(prev => ({
          ...prev,
          owner_id: value,
          email: selectedOwner.email || '',
        }));
      } else {
        setFormData(prev => ({ ...prev, owner_id: value }));
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await createUser({
        email: formData.email,
        role_id: formData.role_id,
        owner_id: formData.owner_id || undefined
      }, token);
      success('Usuario creado con éxito');
      await fetchData();
      setIsModalOpen(false);
    } catch (err) {
      const msg = err.response?.data?.detail || 'Error al crear usuario.';
      setError(msg);
      toastError(msg);
    }
  };

  const handleToggleStatus = async (user) => {
    try {
      const newStatus = user.status === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
      await updateUser(user.id, { status: newStatus }, token);
      success(`Usuario ${newStatus === 'ACTIVO' ? 'activado' : 'desactivado'} con éxito`);
      await fetchData();
    } catch (err) {
      console.error(err);
      toastError('Error al actualizar estado del usuario');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('es-CL');
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Gestión de Usuarios</h1>
          <p className={styles.subtitle}>Crea y administra los accesos al sistema.</p>
        </div>
        <button className={styles.btnPrimary} onClick={handleOpenModal}>
          + Nuevo Usuario
        </button>
      </div>

      {!isModalOpen && error && <div className={styles.errorText} style={{ marginBottom: '1rem' }}>{error}</div>}

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Email</th>
              <th className={styles.th}>Rol</th>
              <th className={styles.th}>Estado</th>
              <th className={styles.th}>Creado</th>
              <th className={styles.th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" className={styles.td}>Cargando...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan="5" className={styles.td}>No hay usuarios</td></tr>
            ) : (
              users.map(user => (
                <tr key={user.id} className={styles.tr}>
                  <td className={styles.td}>{user.email}</td>
                  <td className={styles.td}>{user.role?.name || '—'}</td>
                  <td className={styles.td}>
                    <span className={`${styles.badge} ${user.status === 'ACTIVO' ? styles.badgeActive : styles.badgeInactive}`}>
                      {user.status}
                    </span>
                  </td>
                  <td className={styles.td}>{formatDate(user.created_at)}</td>
                  <td className={styles.td}>
                    <button 
                      className={styles.btnAction} 
                      onClick={() => handleToggleStatus(user)}
                    >
                      {user.status === 'ACTIVO' ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className={styles.overlay} onClick={handleCloseModal}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Crear Usuario</h2>
            
            {error && <div className={styles.errorText}>{error}</div>}
            
            <form onSubmit={handleSubmit}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Vincular con propietario (opcional)</label>
                <select 
                  className={styles.select} 
                  name="owner_id" 
                  value={formData.owner_id} 
                  onChange={handleChange}
                >
                  <option value="">-- Seleccionar propietario --</option>
                  {owners.map(owner => (
                    <option key={owner.id} value={owner.id}>
                      {owner.full_name} ({owner.document_id})
                    </option>
                  ))}
                </select>
                <small style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                  Seleccionar un propietario autocompletará el correo.
                </small>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Email</label>
                <input 
                  type="email" 
                  name="email" 
                  className={styles.input} 
                  value={formData.email} 
                  onChange={handleChange} 
                  required 
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Rol</label>
                <select 
                  className={styles.select} 
                  name="role_id" 
                  value={formData.role_id} 
                  onChange={handleChange}
                  required
                >
                  {roles.map(role => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.modalActions}>
                <button type="button" className={styles.btnCancel} onClick={handleCloseModal}>Cancelar</button>
                <button type="submit" className={styles.btnPrimary}>Crear</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

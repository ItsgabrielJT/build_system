import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import FormModal from '../FormModal/FormModal';
import * as apartmentService from '../../services/apartmentService';
import * as ownerService from '../../services/ownerService';
import styles from './ApartmentDetailModal.module.css';

const STATUS_OPTIONS = [
  { value: 'VACANTE', label: 'Vacante' },
  { value: 'OCUPADO', label: 'Ocupado' },
  { value: 'MANTENIMIENTO', label: 'En mantenimiento' },
];

const EDIT_FIELDS = [
  { name: 'code', label: 'Código', required: true },
  { name: 'floor', label: 'Piso', type: 'number', min: 1 },
  { name: 'tower', label: 'Torre' },
  { name: 'status', label: 'Estado', type: 'select', options: STATUS_OPTIONS },
];

import { useNotification } from '../../context/NotificationContext';

export default function ApartmentDetailModal({ apartment, onClose, onRefresh }) {
  const { token } = useAuth();
  const { success, error: toastError } = useNotification();
  const [fullData, setFullData] = useState(null);
  const [allOwners, setAllOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedOwnerId, setSelectedOwnerId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!apartment?.id || !token) return;
    setLoading(true);
    setError(null);
    Promise.all([
      apartmentService.getApartment(token, apartment.id),
      ownerService.getOwners(token),
    ])
      .then(([aptData, ownersData]) => {
        setFullData(aptData);
        const owners = Array.isArray(ownersData) ? ownersData : ownersData.items || [];
        setAllOwners(owners);
      })
      .catch(() => setError('Error al cargar datos del apartamento'))
      .finally(() => setLoading(false));
  }, [apartment?.id, token]);

  if (!apartment) return null;

  const handleSaveEdit = async (formData) => {
    try {
      const payload = {
        code: formData.code,
        floor: formData.floor ? parseInt(formData.floor, 10) : undefined,
        tower: formData.tower || undefined,
        status: formData.status || undefined,
      };
      await apartmentService.updateApartment(apartment.id, payload, token);
      success('Apartamento actualizado con éxito');
      setShowEditModal(false);
      onRefresh?.();
      onClose();
    } catch (err) {
      toastError(err.response?.data?.detail || 'Error al actualizar apartamento');
    }
  };

  const handleAssignOwner = async () => {
    if (!selectedOwnerId) return;
    setAssigning(true);
    setError(null);
    try {
      await apartmentService.assignOwner(apartment.id, selectedOwnerId, {}, token);
      success('Propietario asignado con éxito');
      onRefresh?.();
      onClose();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Error al asignar propietario';
      setError(msg);
      toastError(msg);
    } finally {
      setAssigning(false);
    }
  };

  const handleRemoveOwner = async () => {
    if (!fullData?.owner_id) return;
    setRemoving(true);
    setError(null);
    try {
      await apartmentService.removeOwner(apartment.id, fullData.owner_id, token);
      success('Propietario desvinculado con éxito');
      onRefresh?.();
      onClose();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Error al quitar propietario';
      setError(msg);
      toastError(msg);
    } finally {
      setRemoving(false);
    }
  };

  const getStatusLabel = (status) => {
    if (status === 'OCUPADO') return { label: 'Ocupado', color: '#27ae60', bg: 'rgba(39,174,96,0.12)' };
    if (status === 'VACANTE') return { label: 'Vacante', color: '#3498db', bg: 'rgba(52,152,219,0.12)' };
    if (status === 'MANTENIMIENTO') return { label: 'En mantenimiento', color: '#e67e22', bg: 'rgba(230,126,34,0.12)' };
    return { label: status, color: '#666', bg: '#f0f0f0' };
  };

  const statusInfo = getStatusLabel(apartment.status);
  const ownersForSelect = allOwners.filter((o) => o.id !== fullData?.owner_id);

  return (
    <div className={styles.modal} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Detalles del Apartamento</h2>
          <div className={styles.headerActions}>
            <button className={styles.editButton} onClick={() => setShowEditModal(true)} type="button">
              ✏️ Editar
            </button>
            <button className={styles.closeButton} onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div className={styles.modalBody}>
          {loading ? (
            <p className={styles.loadingText}>Cargando...</p>
          ) : (
            <>
              {/* Información del Apartamento */}
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>
                  <span className={styles.sectionIcon}>🏢</span>
                  Información del Apartamento
                </h3>
                <div className={styles.infoGrid}>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Código</span>
                    <span className={styles.infoValue}>{apartment.code}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Estado</span>
                    <span
                      className={styles.statusBadge}
                      style={{ color: statusInfo.color, background: statusInfo.bg }}
                    >
                      {statusInfo.label}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Piso</span>
                    <span className={styles.infoValue}>{apartment.floor ?? '—'}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Torre</span>
                    <span className={styles.infoValue}>{apartment.tower || '—'}</span>
                  </div>
                  {apartment.area_sqm != null && (
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Área</span>
                      <span className={styles.infoValue}>{apartment.area_sqm} m²</span>
                    </div>
                  )}
                  {apartment.allocated_quota_percent != null && (
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Alícuota</span>
                      <span className={styles.infoValue}>{apartment.allocated_quota_percent?.toFixed(2)}%</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Propietario */}
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>
                  <span className={styles.sectionIcon}>👤</span>
                  Propietario
                </h3>

                {fullData?.owner_id ? (
                  <div className={styles.ownerRow}>
                    <div>
                      <div className={styles.ownerName}>{fullData.owner_name || '—'}</div>
                      {fullData.owner_email && (
                        <div className={styles.ownerEmail}>{fullData.owner_email}</div>
                      )}
                    </div>
                    <button
                      className={styles.removeOwnerBtn}
                      onClick={handleRemoveOwner}
                      disabled={removing}
                      type="button"
                    >
                      {removing ? '...' : 'Quitar'}
                    </button>
                  </div>
                ) : (
                  <div className={styles.assignRow}>
                    <select
                      className={styles.assignSelect}
                      value={selectedOwnerId}
                      onChange={(e) => setSelectedOwnerId(e.target.value)}
                    >
                      <option value="">Seleccionar propietario...</option>
                      {ownersForSelect.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.full_name} — {o.document_id}
                        </option>
                      ))}
                    </select>
                    <button
                      className={styles.assignBtn}
                      onClick={handleAssignOwner}
                      disabled={!selectedOwnerId || assigning}
                      type="button"
                    >
                      {assigning ? 'Asignando...' : 'Asignar'}
                    </button>
                  </div>
                )}

                {error && <p className={styles.errorMsg}>{error}</p>}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          <button className={styles.buttonSecondary} onClick={onClose}>Cerrar</button>
        </div>
      </div>

      <FormModal
        isOpen={showEditModal}
        title="Editar Apartamento"
        fields={EDIT_FIELDS}
        initialData={fullData ?? apartment}
        onSubmit={handleSaveEdit}
        onClose={() => setShowEditModal(false)}
      />
    </div>
  );
}

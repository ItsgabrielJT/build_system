import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import FormModal from '../FormModal/FormModal';
import * as ownerService from '../../services/ownerService';
import * as apartmentService from '../../services/apartmentService';
import styles from './OwnerDetailModal.module.css';

const EDIT_FIELDS = [
  { name: 'full_name', label: 'Nombre completo', required: true },
  { name: 'document_id', label: 'Documento de identidad', required: true },
  { name: 'email', label: 'Correo electrónico', type: 'email' },
  { name: 'phone', label: 'Teléfono', type: 'tel' },
  { name: 'allocated_quota_percent', label: 'Alícuota (%)', type: 'number', min: '0', step: '0.01' },
];

import { useNotification } from '../../context/NotificationContext';

export default function OwnerDetailModal({ owner, onClose, onRefresh }) {
  const { token } = useAuth();
  const { success, error: toastError } = useNotification();
  const [showEditModal, setShowEditModal] = useState(false);
  const [availableApartments, setAvailableApartments] = useState([]);
  const [selectedAptId, setSelectedAptId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token || !owner) return;
    apartmentService.getApartments(token).then((data) => {
      const all = Array.isArray(data) ? data : data.items || [];
      const assignedIds = new Set((owner.units || []).map((u) => u.id));
      setAvailableApartments(all.filter((a) => !assignedIds.has(a.id)));
    }).catch(() => setAvailableApartments([]));
  }, [token, owner]);
  if (!owner) return null;

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  };

  const formatBalance = (balance) => {
    const formatted = Math.abs(balance).toLocaleString('es-ES', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    });
    return `$${formatted}`;
  };

  const handleSaveEdit = async (formData) => {
    try {
      const payload = {
        full_name: formData.full_name,
        document_id: formData.document_id,
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        allocated_quota_percent: formData.allocated_quota_percent === ''
          ? 0
          : Number(formData.allocated_quota_percent),
      };
      await ownerService.updateOwner(owner.id, payload, token);
      success('Propietario actualizado con éxito');
      setShowEditModal(false);
      onRefresh?.();
      onClose();
    } catch (err) {
      toastError(err.response?.data?.detail || 'Error al actualizar propietario');
    }
  };

  const handleAssignApartment = async () => {
    if (!selectedAptId) return;
    setAssigning(true);
    setError(null);
    try {
      await apartmentService.assignOwner(selectedAptId, owner.id, {}, token);
      success('Apartamento asignado con éxito');
      onRefresh?.();
      onClose();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Error al asignar apartamento';
      setError(msg);
      toastError(msg);
    } finally {
      setAssigning(false);
    }
  };

  const handleRemoveUnit = async (unitId) => {
    setRemoving(unitId);
    setError(null);
    try {
      await apartmentService.removeOwner(unitId, owner.id, token);
      success('Apartamento desvinculado con éxito');
      onRefresh?.();
      onClose();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Error al quitar apartamento';
      setError(msg);
      toastError(msg);
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className={styles.modal} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Detalles del Propietario</h2>
          <div className={styles.headerActions}>
            <button className={styles.editButton} onClick={() => setShowEditModal(true)} type="button">
              ✏️ Editar
            </button>
            <button className={styles.closeButton} onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div className={styles.modalBody}>
          {/* Información Personal */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
              <span className={styles.sectionIcon}>👤</span>
              Información Personal
            </h3>
            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Nombre Completo</span>
                <span className={styles.infoValue}>{owner.full_name}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Documento</span>
                <span className={styles.infoValue}>{owner.document_id || '—'}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Email</span>
                <span className={styles.infoValue}>{owner.email || '—'}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Teléfono</span>
                <span className={styles.infoValue}>{owner.phone || '—'}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Fecha de Ingreso</span>
                <span className={styles.infoValue}>{formatDate(owner.ingress_date)}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Alícuota</span>
                <span className={styles.infoValue}>{Number(owner.allocated_quota_percent || 0).toFixed(2)}%</span>
              </div>
            </div>
          </div>

          {/* Unidades Asignadas */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
              <span className={styles.sectionIcon}>🏠</span>
              Unidades Asignadas ({(owner.units || []).length})
            </h3>
            <div className={styles.unitsList}>
              {(owner.units || []).map((unit) => (
                <div key={unit.id} className={styles.unitItem}>
                  <div>
                    <div className={styles.unitCode}>{unit.code}</div>
                    <div className={styles.unitLocation}>
                      {unit.tower && `Torre ${unit.tower}`}
                      {unit.tower && unit.floor && ' - '}
                      {unit.floor && `Piso ${unit.floor}`}
                    </div>
                  </div>
                  <button
                    className={styles.removeUnitBtn}
                    onClick={() => handleRemoveUnit(unit.id)}
                    disabled={removing === unit.id}
                    type="button"
                    title="Quitar asignación"
                  >
                    {removing === unit.id ? '...' : '✕'}
                  </button>
                </div>
              ))}
            </div>

            {availableApartments.length > 0 && (
              <div className={styles.assignRow}>
                <select
                  className={styles.assignSelect}
                  value={selectedAptId}
                  onChange={(e) => setSelectedAptId(e.target.value)}
                >
                  <option value="">Asignar apartamento...</option>
                  {availableApartments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code}{a.tower ? ` – Torre ${a.tower}` : ''}{a.floor ? ` Piso ${a.floor}` : ''}
                    </option>
                  ))}
                </select>
                <button
                  className={styles.assignBtn}
                  onClick={handleAssignApartment}
                  disabled={!selectedAptId || assigning}
                  type="button"
                >
                  {assigning ? 'Asignando...' : 'Asignar'}
                </button>
              </div>
            )}
            {error && <p className={styles.errorMsg}>{error}</p>}
          </div>

          {/* Balance Consolidado */}
          <div className={styles.section}>
            <div
              className={styles.balanceSection}
              style={{
                backgroundColor: owner.balance < 0 ? '#fef5f5' : '#f0f9f6',
                borderLeftColor: owner.balance < 0 ? '#e74c3c' : '#27ae60',
              }}
            >
              <div className={styles.balanceLabel}>Balance Consolidado</div>
              <div className={`${styles.balanceValue} ${owner.balance < 0 ? styles.negative : ''}`}>
                {owner.balance < 0 ? '-' : ''}{formatBalance(owner.balance)}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          <button className={styles.buttonSecondary} onClick={onClose}>Cerrar</button>
        </div>
      </div>

      <FormModal
        isOpen={showEditModal}
        title="Editar Propietario"
        fields={EDIT_FIELDS}
        initialData={owner}
        onSubmit={handleSaveEdit}
        onClose={() => setShowEditModal(false)}
      />
    </div>
  );
}

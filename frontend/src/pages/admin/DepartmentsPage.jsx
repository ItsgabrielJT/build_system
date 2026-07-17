import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useApartmentDirectory } from '../../hooks/useApartmentDirectory';
import DepartmentStats from '../../components/DepartmentStats/DepartmentStats';
import ApartmentGrid from '../../components/ApartmentGrid/ApartmentGrid';
import FormModal from '../../components/FormModal/FormModal';
import ApartmentDetailModal from '../../components/ApartmentDetailModal/ApartmentDetailModal';
import styles from './DepartmentsPage.module.css';

const STATUS_COLORS = {
  Ocupados: '#2563eb',
  Vacantes: '#16a34a',
  Mantenimiento: '#d97706',
};

export default function DepartmentsPage() {
  const navigate = useNavigate();
  const {
    statistics,
    apartments,
    currentPage,
    totalPages,
    total,
    filter,
    buildingFilter,
    loading,
    error,
    showCreateModal,
    buildings,
    onFilterChange,
    onBuildingFilterChange,
    onPageChange,
    onOpenCreateModal,
    onCloseCreateModal,
    onCreateApartment,
    onRefresh,
  } = useApartmentDirectory();

  const [selectedApartment, setSelectedApartment] = useState(null);
  const [query, setQuery] = useState('');

  const buildingOptions = buildings.map((b) => ({ value: b.id, label: b.name }));
  const visibleApartments = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return apartments;
    return apartments.filter((apartment) => [
      apartment.code,
      apartment.floor,
      apartment.tower,
      apartment.owner_name,
      apartment.status,
    ].some((value) => String(value || '').toLowerCase().includes(normalized)));
  }, [apartments, query]);

  const statusData = useMemo(() => ([
    { name: 'Ocupados', value: Number(statistics?.occupied || 0) },
    { name: 'Vacantes', value: Number(statistics?.vacant || 0) },
    { name: 'Mantenimiento', value: Number(statistics?.maintenance || 0) },
  ]), [statistics]);

  const towerData = useMemo(() => {
    const map = new Map();
    visibleApartments.forEach((apartment) => {
      const key = apartment.tower || 'Sin torre';
      const current = map.get(key) || { tower: key, departamentos: 0 };
      current.departamentos += 1;
      map.set(key, current);
    });
    return [...map.values()].sort((a, b) => b.departamentos - a.departamentos).slice(0, 6);
  }, [visibleApartments]);

  const occupiedRate = Number(statistics?.occupancy_rate_percent || 0);

  const createApartmentFields = [
    { name: 'code', label: 'Código de apartamento', required: true, placeholder: 'Ej: 101, A-202' },
    { name: 'floor', label: 'Piso', type: 'number', placeholder: 'Ej: 1', min: 1 },
    { name: 'tower', label: 'Torre', placeholder: 'Ej: A, Norte' },
    { name: 'parking', label: 'Parqueadero', placeholder: 'Ej: 1 (P-28)' },
    { name: 'bathrooms', label: 'Baños', type: 'number', min: 0, step: '0.5', placeholder: 'Ej: 2.5' },
    { name: 'bedrooms', label: 'Habitaciones', type: 'number', min: 0, step: '1', placeholder: 'Ej: 3' },
    { name: 'unit_type', label: 'Tipo de unidad', placeholder: 'Ej: Residencial' },
    { name: 'storage', label: 'Bodega', placeholder: 'Ej: B-12' },
    { name: 'acquisition_date', label: 'Fecha de adquisición', type: 'date' },
    { name: 'use_type', label: 'Uso del departamento', placeholder: 'Ej: Residencial' },
    { name: 'pet_count', label: 'Número de mascotas', type: 'number', min: 0, step: '1', placeholder: 'Ej: 2' },
    { name: 'vehicle_plates', label: 'Placas de vehículos', type: 'textarea', placeholder: 'Ej: PBC1234, JDE5678 o una por línea' },
    ...(buildingOptions.length > 0
      ? [{ name: 'building_id', label: 'Edificio', type: 'select', options: buildingOptions }]
      : []),
  ];

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <div className={styles.breadcrumb}>Admin / Departamentos</div>
          <h1 className={styles.title}>Directorio de Departamentos</h1>
          <p className={styles.subtitle}>
            Estado de ocupación, unidades y asignaciones de propietarios con filtros operativos.
          </p>
        </div>
        <div className={styles.headerActions}>
          <select
            className={styles.select}
            value={buildingFilter}
            onChange={(event) => onBuildingFilterChange(event.target.value)}
            aria-label="Filtrar edificio"
          >
            <option value="">Todos los edificios</option>
            {buildingOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <button
            className={styles.btnSecondary}
            onClick={() => navigate('/admin/settings')}
          >
            Configurar edificio
          </button>
          <button className={styles.btnPrimary} onClick={onOpenCreateModal}>
          + Agregar Apartamento
          </button>
        </div>
      </section>

      {error && <div className={styles.errorBanner}>{error}</div>}

      {loading && statistics === null ? (
        <div className={styles.loadingContainer}>
          <p>Cargando departamentos...</p>
        </div>
      ) : (
        <>
          <DepartmentStats statistics={statistics} loading={loading} />

          <section className={styles.dashboardGrid}>
            <article className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2>Distribución por estado</h2>
                  <p>Ocupación calculada desde el directorio de departamentos.</p>
                </div>
                <span className={styles.ratePill}>{occupiedRate.toFixed(1)}% ocupación</span>
              </div>
              {statistics?.total ? (
                <div className={styles.chartBox}>
                  <ResponsiveContainer width="100%" height={230}>
                    <PieChart>
                      <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={82} paddingAngle={4}>
                        {statusData.map((entry) => (
                          <Cell key={entry.name} fill={STATUS_COLORS[entry.name]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className={styles.emptyState}>No hay departamentos para graficar.</div>
              )}
            </article>

            <article className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2>Departamentos por torre</h2>
                  <p>Conteo de unidades visibles con filtros y búsqueda.</p>
                </div>
              </div>
              {towerData.length ? (
                <div className={styles.chartBox}>
                  <ResponsiveContainer width="100%" height={230}>
                    <BarChart data={towerData} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="tower" tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Bar dataKey="departamentos" fill="#2563eb" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className={styles.emptyState}>No hay torres para graficar.</div>
              )}
            </article>
          </section>

          <section className={styles.panel}>
            <div className={styles.listHeader}>
              <div>
                <h2>Unidades</h2>
                <p>{visibleApartments.length} de {total} departamentos según los filtros actuales.</p>
              </div>
              <input
                className={styles.searchInput}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar código, torre o propietario"
              />
            </div>

            <ApartmentGrid
              apartments={visibleApartments}
              currentPage={currentPage}
              totalPages={totalPages}
              total={total}
              filter={filter}
              loading={loading}
              onFilterChange={onFilterChange}
              onPageChange={onPageChange}
              onCardClick={(apartment) => setSelectedApartment(apartment)}
            />
          </section>
        </>
      )}

      {selectedApartment && (
        <ApartmentDetailModal
          apartment={selectedApartment}
          onClose={() => setSelectedApartment(null)}
          onRefresh={onRefresh}
        />
      )}

      <FormModal
        isOpen={showCreateModal}
        title="Agregar Apartamento"
        fields={createApartmentFields}
        onSubmit={onCreateApartment}
        onClose={onCloseCreateModal}
      />
    </div>
  );
}

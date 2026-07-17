import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminFeesPage from '../../pages/admin/AdminFeesPage';
import { useApartmentFees } from '../../hooks/useApartmentFees';
import { useApartments } from '../../hooks/useApartments';
import { useApartmentFeeStats } from '../../hooks/useApartmentFeeStats';
import { usePeriodsSummary } from '../../hooks/usePeriodsSummary';

vi.mock('../../hooks/useApartmentFees', () => ({ useApartmentFees: vi.fn() }));
vi.mock('../../hooks/useApartments', () => ({ useApartments: vi.fn() }));
vi.mock('../../hooks/useApartmentFeeStats', () => ({ useApartmentFeeStats: vi.fn() }));
vi.mock('../../hooks/usePeriodsSummary', () => ({ usePeriodsSummary: vi.fn() }));
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    token: 'test-token',
    user: { id: 'user1' },
    role: 'ADMIN',
  }),
}));
vi.mock('../../context/NotificationContext', () => ({
  useNotification: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));
vi.mock('../../services/apartmentFeeService', () => ({
  getFeesByPeriod: vi.fn(() => Promise.resolve([
    { id: 'fee1', apartment_id: 'apt1', period: '2026-07', amount: 200, paid_amount: 100 }
  ])),
  getApartmentFeeStats: vi.fn(() => Promise.resolve({
    total_emitido: 200,
    total_recaudado: 100,
    pendiente_cobro: 100,
    porcentaje_recaudado: 50,
    unidades_deuda_vencida: 1,
    tendencia_emitido: 0,
  })),
}));

describe('AdminFeesPage', () => {
  const fetchStats = vi.fn();
  const fetchPeriods = vi.fn();
  const fetchFees = vi.fn();
  const fetchApartments = vi.fn();
  const deleteFee = vi.fn();
  const createFee = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    useApartmentFeeStats.mockReturnValue({
      stats: {
        total_emitido: 200,
        total_recaudado: 100,
        pendiente_cobro: 100,
        porcentaje_recaudado: 50,
        unidades_deuda_vencida: 1,
        tendencia_emitido: 0,
      },
      fetchStats,
    });

    usePeriodsSummary.mockReturnValue({
      periods: [
        { period: '2026-07', label: 'Julio 2026', total_emitido: 200, total_recaudado: 100, morosidad_pct: 50, estado: 'ABIERTO' }
      ],
      loading: false,
      fetchPeriods,
    });

    useApartmentFees.mockReturnValue({
      fees: [],
      loading: false,
      error: null,
      fetchFees,
      createFee,
      bulkUpload: vi.fn(),
      deleteFee,
      bulkDelete: vi.fn(),
    });

    useApartments.mockReturnValue({
      apartments: [
        { id: 'apt1', code: '101', owner_allocated_quota_percent: 50, owner_name: 'Juan' },
        { id: 'apt2', code: '102', owner_allocated_quota_percent: 50, owner_name: 'Pedro' },
      ],
      loading: false,
      fetchApartments,
    });
  });

  it('renderiza la página y permite ver el detalle del período', async () => {
    render(<AdminFeesPage />);

    expect(screen.getByText('Gestión de Cuotas')).toBeInTheDocument();

    // Click "Ver detalle" button (eye icon)
    const viewDetailBtn = screen.getByTitle('Ver detalle');
    fireEvent.click(viewDetailBtn);

    // Wait for modal table to display
    await waitFor(() => {
      expect(screen.getByText('Cuotas — Julio 2026')).toBeInTheDocument();
    });

    // Check that we display the apartment code
    expect(screen.getByText('101')).toBeInTheDocument();

    // Form for assigning quota to apartment without it (Pedro has apt2, which has no fee in the list)
    expect(screen.getByText('Asignar cuota a departamento sin cuota')).toBeInTheDocument();
  });

  it('abre el diálogo de confirmación personalizado al hacer clic en eliminar cuota', async () => {
    render(<AdminFeesPage />);

    // Click "Ver detalle" button
    const viewDetailBtn = screen.getByTitle('Ver detalle');
    fireEvent.click(viewDetailBtn);

    // Wait for table to load
    await waitFor(() => {
      expect(screen.getByText('Cuotas — Julio 2026')).toBeInTheDocument();
    });

    // Check click "Eliminar" on the fee row
    const deleteBtn = screen.getByRole('button', { name: 'Eliminar' });
    fireEvent.click(deleteBtn);

    // Custom confirmation modal should appear
    expect(screen.getByText('¿Eliminar esta cuota?')).toBeInTheDocument();
    expect(screen.getByText('Se eliminará la cuota de este departamento en el período 2026-07 y se borrarán de forma permanente todos los pagos asociados a ella.')).toBeInTheDocument();

    // Click "Eliminar de todos modos" button
    const confirmDeleteBtn = screen.getByRole('button', { name: 'Eliminar de todos modos' });
    fireEvent.click(confirmDeleteBtn);

    // Should call deleteFee hook callback
    await waitFor(() => {
      expect(deleteFee).toHaveBeenCalledWith('fee1');
    });
  });
});

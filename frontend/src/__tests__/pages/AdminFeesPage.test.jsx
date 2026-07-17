import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminFeesPage from '../../pages/admin/AdminFeesPage';
import { useApartmentFees } from '../../hooks/useApartmentFees';
import { useApartments } from '../../hooks/useApartments';
import { useApartmentFeeStats } from '../../hooks/useApartmentFeeStats';
import { usePeriodsSummary } from '../../hooks/usePeriodsSummary';
import { getFeesByPeriod } from '../../services/apartmentFeeService';


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

  it('ordena las cuotas y departamentos según torre, piso y código descendente', async () => {
    useApartments.mockReturnValue({
      apartments: [
        { id: 'apt_empty', code: '100', floor: 1, tower: null, owner_name: 'Empty Tower' },
        { id: 'apt_c1_f1', code: '101', floor: 1, tower: 'C1', owner_name: 'C1 F1' },
        { id: 'apt_c1_f2', code: '102', floor: 2, tower: 'C1', owner_name: 'C1 F2' },
        { id: 'apt_c1_f2_code2', code: '103', floor: 2, tower: 'C1', owner_name: 'C1 F2 Code 2' },
        { id: 'apt_b', code: '104', floor: 1, tower: 'B', owner_name: 'B Tower' },
        { id: 'apt_suit_f1', code: '105', floor: 1, tower: 'Suit', owner_name: 'Suit F1' },
        { id: 'apt_suit_f2', code: '106', floor: 2, tower: 'Suit', owner_name: 'Suit F2' },
        { id: 'apt_a', code: '107', floor: 1, tower: 'A', owner_name: 'A Tower' },
      ],
      loading: false,
      fetchApartments,
    });

    vi.mocked(getFeesByPeriod).mockResolvedValue([
      { id: 'fee_empty', apartment_id: 'apt_empty', period: '2026-07', amount: 100 },
      { id: 'fee_c1_f1', apartment_id: 'apt_c1_f1', period: '2026-07', amount: 100 },
      { id: 'fee_c1_f2', apartment_id: 'apt_c1_f2', period: '2026-07', amount: 100 },
      { id: 'fee_c1_f2_code2', apartment_id: 'apt_c1_f2_code2', period: '2026-07', amount: 100 },
      { id: 'fee_b', apartment_id: 'apt_b', period: '2026-07', amount: 100 },
      { id: 'fee_suit_f1', apartment_id: 'apt_suit_f1', period: '2026-07', amount: 100 },
      { id: 'fee_suit_f2', apartment_id: 'apt_suit_f2', period: '2026-07', amount: 100 },
      { id: 'fee_a', apartment_id: 'apt_a', period: '2026-07', amount: 100 },
    ]);

    render(<AdminFeesPage />);

    const viewDetailBtn = screen.getByTitle('Ver detalle');
    fireEvent.click(viewDetailBtn);

    await waitFor(() => {
      expect(screen.getByText('Cuotas — Julio 2026')).toBeInTheDocument();
    });

    // Encontrar los códigos en las celdas para verificar el orden exacto de las filas:
    const codeCells = screen.getAllByRole('cell').filter((cell) => {
      return ['106', '105', '103', '102', '101', '104', '107', '100'].includes(cell.textContent);
    });
    const codeTexts = codeCells.map(cell => cell.textContent);
    expect(codeTexts).toEqual(['106', '105', '103', '102', '101', '104', '107', '100']);

    // Verificar las torres correspondientes:
    const towerCells = screen.getAllByRole('cell').filter((cell) => {
      return ['Suit', 'C1', 'B', 'A', '—'].includes(cell.textContent);
    });
    const towerTexts = towerCells.map(cell => cell.textContent);
    expect(towerTexts).toEqual(['Suit', 'Suit', 'C1', 'C1', 'C1', 'B', 'A', '—']);
  });
});


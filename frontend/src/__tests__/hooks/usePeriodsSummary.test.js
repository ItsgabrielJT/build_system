import { renderHook, act } from '@testing-library/react';
import { usePeriodsSummary } from '../../hooks/usePeriodsSummary';
import * as apartmentFeeService from '../../services/apartmentFeeService';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ token: 'test-token' }),
}));

vi.mock('../../services/apartmentFeeService', () => ({
  getPeriodsSummary: vi.fn(),
}));

describe('usePeriodsSummary', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with empty periods array', () => {
    const { result } = renderHook(() => usePeriodsSummary());

    expect(result.current.periods).toEqual([]);
    expect(result.current.total).toBe(0);
    expect(result.current.page).toBe(1);
    expect(result.current.pageSize).toBe(10);
    expect(result.current.year).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('fetches periods with default pagination', async () => {
    apartmentFeeService.getPeriodsSummary.mockResolvedValue({
      data: [{ period: '2026-05', status: 'ABIERTO' }],
      total: 1,
    });

    const { result } = renderHook(() => usePeriodsSummary());

    await act(async () => {
      await result.current.fetchPeriods();
    });

    expect(apartmentFeeService.getPeriodsSummary).toHaveBeenCalledWith(1, 10, null, 'test-token');
    expect(result.current.periods).toEqual([{ period: '2026-05', status: 'ABIERTO' }]);
    expect(result.current.total).toBe(1);
    expect(result.current.page).toBe(1);
  });

  it('updates page state when setPage is called', async () => {
    apartmentFeeService.getPeriodsSummary.mockResolvedValue({
      data: [{ period: '2026-04', status: 'VENCIDO' }],
      total: 20,
    });

    const { result } = renderHook(() => usePeriodsSummary());

    await act(async () => {
      await result.current.fetchPeriods(2, 10, null);
    });

    expect(apartmentFeeService.getPeriodsSummary).toHaveBeenCalledWith(2, 10, null, 'test-token');
    expect(result.current.page).toBe(2);
  });

  it('filters by year when year param provided', async () => {
    apartmentFeeService.getPeriodsSummary.mockResolvedValue({
      data: [{ period: '2026-03', status: 'CERRADO' }],
      total: 1,
    });

    const { result } = renderHook(() => usePeriodsSummary());

    await act(async () => {
      await result.current.fetchPeriods(1, 10, 2026);
    });

    expect(apartmentFeeService.getPeriodsSummary).toHaveBeenCalledWith(1, 10, 2026, 'test-token');
    expect(result.current.year).toBe(2026);
    expect(result.current.periods).toEqual([{ period: '2026-03', status: 'CERRADO' }]);
  });
});
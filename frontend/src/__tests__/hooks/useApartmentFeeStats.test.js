import { renderHook, act } from '@testing-library/react';
import { useApartmentFeeStats } from '../../hooks/useApartmentFeeStats';
import * as apartmentFeeService from '../../services/apartmentFeeService';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ token: 'test-token' }),
}));

vi.mock('../../services/apartmentFeeService', () => ({
  getApartmentFeeStats: vi.fn(),
}));

describe('useApartmentFeeStats', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with null stats and loading false', () => {
    const { result } = renderHook(() => useApartmentFeeStats());

    expect(result.current.stats).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sets loading true during fetch', async () => {
    let resolveRequest;
    apartmentFeeService.getApartmentFeeStats.mockImplementation(
      () => new Promise((resolve) => {
        resolveRequest = resolve;
      })
    );

    const { result } = renderHook(() => useApartmentFeeStats());

    let pendingRequest;
    act(() => {
      pendingRequest = result.current.fetchStats('2026-05');
    });

    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolveRequest({ total_emitido: 1240500 });
      await pendingRequest;
    });

    expect(result.current.loading).toBe(false);
  });

  it('sets stats after successful fetch', async () => {
    const statsResponse = {
      period: '2026-05',
      total_emitido: 1240500,
      total_recaudado: 892300,
    };
    apartmentFeeService.getApartmentFeeStats.mockResolvedValue(statsResponse);

    const { result } = renderHook(() => useApartmentFeeStats());

    await act(async () => {
      await result.current.fetchStats('2026-05');
    });

    expect(apartmentFeeService.getApartmentFeeStats).toHaveBeenCalledWith('2026-05', 'test-token');
    expect(result.current.stats).toEqual(statsResponse);
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('sets error on failed fetch', async () => {
    apartmentFeeService.getApartmentFeeStats.mockRejectedValue({
      response: { data: { detail: 'Fallo API stats' } },
    });

    const { result } = renderHook(() => useApartmentFeeStats());

    await act(async () => {
      await result.current.fetchStats('2026-05');
    });

    expect(result.current.error).toBe('Fallo API stats');
    expect(result.current.loading).toBe(false);
  });
});
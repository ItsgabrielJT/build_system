import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMonthlyBalance } from '../../hooks/useMonthlyBalance';
import * as reportService from '../../services/reportService';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ token: 'test-token' }),
}));

vi.mock('../../services/reportService', () => ({
  getAdminMonthlyBalance: vi.fn(),
  getOwnerMonthlyBalance: vi.fn(),
}));

describe('useMonthlyBalance', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('loads admin monthly balance successfully', async () => {
    const payload = { period: '2026-05', income_total: 1000 };
    reportService.getAdminMonthlyBalance.mockResolvedValue(payload);

    const { result } = renderHook(() => useMonthlyBalance('ADMIN', '2026-05'));

    await waitFor(() => {
      expect(result.current.data).toEqual(payload);
    });

    expect(reportService.getAdminMonthlyBalance).toHaveBeenCalledWith('2026-05', 'test-token');
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('handles api error', async () => {
    reportService.getOwnerMonthlyBalance.mockRejectedValue({
      response: { data: { detail: 'Periodo inválido' } },
    });

    const { result } = renderHook(() => useMonthlyBalance('PROPIETARIO', '2026-13'));

    await waitFor(() => {
      expect(result.current.error).toBe('Periodo inválido');
    });

    expect(result.current.loading).toBe(false);
  });

  it('reloads current period on demand', async () => {
    reportService.getAdminMonthlyBalance.mockResolvedValue({ period: '2026-05', income_total: 900 });

    const { result } = renderHook(() => useMonthlyBalance('ADMIN', '2026-05'));

    await waitFor(() => {
      expect(reportService.getAdminMonthlyBalance).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await result.current.reload();
    });

    expect(reportService.getAdminMonthlyBalance).toHaveBeenCalledTimes(2);
  });
});
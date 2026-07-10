import { renderHook, act, waitFor } from '@testing-library/react';
import { useAccountStatement } from '../../hooks/useAccountStatement';
import * as accountStatementService from '../../services/accountStatementService';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ token: 'fake-token' }),
}));

vi.mock('../../services/accountStatementService', () => ({
  getAccountStatement: vi.fn(),
  exportAccountStatement: vi.fn(),
}));

describe('useAccountStatement', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('carga estado de cuenta exitosamente', async () => {
    const lines = [{ period: '2026-05', apartment_code: '101', saldo: 200 }];
    accountStatementService.getAccountStatement.mockResolvedValue(lines);

    const { result } = renderHook(() => useAccountStatement());

    expect(result.current.statement).toEqual([]);
    expect(result.current.loading).toBe(false);

    await act(async () => {
      await result.current.fetchStatement({ start_period: '2026-05', end_period: '2026-05' });
    });

    expect(accountStatementService.getAccountStatement).toHaveBeenCalledWith('fake-token', {
      start_period: '2026-05',
      end_period: '2026-05',
    });
    expect(result.current.statement).toEqual(lines);
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('maneja error en carga', async () => {
    accountStatementService.getAccountStatement.mockRejectedValue({
      response: { data: { detail: 'Fallo API' } },
    });

    const { result } = renderHook(() => useAccountStatement());

    await act(async () => {
      await result.current.fetchStatement();
    });

    expect(result.current.error).toBe('Fallo API');
    expect(result.current.loading).toBe(false);
  });

  it('exporta y dispara descarga', async () => {
    const fakeBlob = new Blob(['file'], { type: 'application/pdf' });

    accountStatementService.exportAccountStatement.mockResolvedValue(fakeBlob);

    const { result } = renderHook(() => useAccountStatement());

    let exportedBlob = null;

    await act(async () => {
      exportedBlob = await result.current.exportStatement('pdf', { start_period: '2026-05' });
    });

    expect(accountStatementService.exportAccountStatement).toHaveBeenCalledWith('fake-token', 'pdf', {
      start_period: '2026-05',
    });
    expect(exportedBlob).toBe(fakeBlob);

    await waitFor(() => expect(result.current.exporting).toBe(false));
  });
});

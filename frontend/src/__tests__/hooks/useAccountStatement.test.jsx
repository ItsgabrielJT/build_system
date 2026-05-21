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
    const clickSpy = vi.fn();
    const anchor = { href: '', download: '', click: clickSpy };

    accountStatementService.exportAccountStatement.mockResolvedValue(fakeBlob);

    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:url');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tagName) => (tagName === 'a' ? anchor : originalCreateElement(tagName)));

    const { result } = renderHook(() => useAccountStatement());

    await act(async () => {
      await result.current.exportStatement('pdf', { start_period: '2026-05' }, 'estado.pdf');
    });

    expect(accountStatementService.exportAccountStatement).toHaveBeenCalledWith('fake-token', 'pdf', {
      start_period: '2026-05',
    });
    expect(createObjectURLSpy).toHaveBeenCalledWith(fakeBlob);
    expect(anchor.download).toBe('estado.pdf');
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:url');

    await waitFor(() => expect(result.current.exporting).toBe(false));

    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
    createElementSpy.mockRestore();
  });
});

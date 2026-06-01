import { renderHook, act } from '@testing-library/react';
import { useAdminPaymentReview } from '../../hooks/useAdminPaymentReview';
import * as paymentService from '../../services/paymentService';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ token: 'admin-token' }),
}));

vi.mock('../../services/paymentService', () => ({
  getPendingPayments: vi.fn(),
  approvePayment: vi.fn(),
  rejectPayment: vi.fn(),
}));

describe('useAdminPaymentReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads pending payments successfully', async () => {
    const pending = [
      { id: 'pay-1', status: 'PENDIENTE_APROBACION' },
      { id: 'pay-2', status: 'PENDIENTE_APROBACION' },
    ];
    paymentService.getPendingPayments.mockResolvedValue(pending);

    const { result } = renderHook(() => useAdminPaymentReview());

    await act(async () => {
      await result.current.fetchPending();
    });

    expect(paymentService.getPendingPayments).toHaveBeenCalledWith('admin-token');
    expect(result.current.pendingPayments).toEqual(pending);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('approves a pending payment and removes it from local list', async () => {
    paymentService.getPendingPayments.mockResolvedValue([
      { id: 'pay-1', status: 'PENDIENTE_APROBACION' },
      { id: 'pay-2', status: 'PENDIENTE_APROBACION' },
    ]);
    paymentService.approvePayment.mockResolvedValue({ id: 'pay-1', status: 'APROBADO' });

    const { result } = renderHook(() => useAdminPaymentReview());

    await act(async () => {
      await result.current.fetchPending();
    });

    await act(async () => {
      await result.current.approvePayment('pay-1');
    });

    expect(paymentService.approvePayment).toHaveBeenCalledWith('pay-1', 'admin-token');
    expect(result.current.pendingPayments).toEqual([{ id: 'pay-2', status: 'PENDIENTE_APROBACION' }]);
  });

  it('rejects a pending payment with reason and removes it from local list', async () => {
    paymentService.getPendingPayments.mockResolvedValue([
      { id: 'pay-9', status: 'PENDIENTE_APROBACION' },
    ]);
    paymentService.rejectPayment.mockResolvedValue({ id: 'pay-9', status: 'RECHAZADO' });

    const { result } = renderHook(() => useAdminPaymentReview());

    await act(async () => {
      await result.current.fetchPending();
    });

    await act(async () => {
      await result.current.rejectPayment('pay-9', 'Comprobante ilegible');
    });

    expect(paymentService.rejectPayment).toHaveBeenCalledWith(
      'pay-9',
      { reason: 'Comprobante ilegible' },
      'admin-token'
    );
    expect(result.current.pendingPayments).toEqual([]);
  });
});

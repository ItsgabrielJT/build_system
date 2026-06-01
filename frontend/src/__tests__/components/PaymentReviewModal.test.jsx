import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PaymentReviewModal from '../../components/PaymentReviewModal/PaymentReviewModal';

const paymentFixture = {
  id: 'pay-77',
  owner_name: 'Ana Lopez',
  apartment_code: 'A-101',
  period: '2026-05',
  amount: 500,
  paid_at: '2026-05-20',
  proof_file_name: 'transferencia.pdf',
  method: 'transferencia',
  reference: 'REF-123',
};

describe('PaymentReviewModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('approves a pending payment', async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn().mockResolvedValue({ id: 'pay-77', status: 'APROBADO' });

    render(
      <PaymentReviewModal
        payment={paymentFixture}
        onApprove={onApprove}
        onReject={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Aprobar' }));

    await waitFor(() => {
      expect(onApprove).toHaveBeenCalledWith('pay-77');
    });
  });

  it('shows validation when rejecting without reason', async () => {
    const user = userEvent.setup();
    const onReject = vi.fn();

    render(
      <PaymentReviewModal
        payment={paymentFixture}
        onApprove={vi.fn()}
        onReject={onReject}
        onClose={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Rechazar' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar rechazo' }));

    expect(screen.getByText('Debe indicar un motivo de rechazo.')).toBeInTheDocument();
    expect(onReject).not.toHaveBeenCalled();
  });

  it('rejects a pending payment with trimmed reason', async () => {
    const user = userEvent.setup();
    const onReject = vi.fn().mockResolvedValue({ id: 'pay-77', status: 'RECHAZADO' });

    render(
      <PaymentReviewModal
        payment={paymentFixture}
        onApprove={vi.fn()}
        onReject={onReject}
        onClose={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Rechazar' }));
    await user.type(screen.getByLabelText(/Motivo de rechazo/i), '  Comprobante ilegible  ');
    await user.click(screen.getByRole('button', { name: 'Confirmar rechazo' }));

    await waitFor(() => {
      expect(onReject).toHaveBeenCalledWith('pay-77', 'Comprobante ilegible');
    });
  });
});

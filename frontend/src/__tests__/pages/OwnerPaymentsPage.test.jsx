import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OwnerPaymentsPage from '../../pages/owner/OwnerPaymentsPage';
import { useOwnerPayments } from '../../hooks/useOwnerPayments';
import { useApartments } from '../../hooks/useApartments';

vi.mock('../../hooks/useOwnerPayments', () => ({ useOwnerPayments: vi.fn() }));
vi.mock('../../hooks/useApartments', () => ({ useApartments: vi.fn() }));
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ token: 'test-token', user: { id: 'owner1' }, role: 'PROPIETARIO' }),
}));

const defaultOwnerPaymentsHook = (overrides = {}) => ({
  payments: [],
  loading: false,
  error: null,
  submitPayment: vi.fn(),
  reload: vi.fn(),
  downloadAcknowledgement: vi.fn(),
  downloadReceipt: vi.fn(),
  ...overrides,
});

const defaultApartmentsHook = (overrides = {}) => ({
  apartments: [{ id: 'apt1', code: '101' }],
  loading: false,
  error: null,
  fetchApartments: vi.fn(),
  ...overrides,
});

describe('OwnerPaymentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders form and empty history', () => {
    useOwnerPayments.mockReturnValue(defaultOwnerPaymentsHook());
    useApartments.mockReturnValue(defaultApartmentsHook());

    render(<OwnerPaymentsPage />);

    expect(screen.getByRole('heading', { name: /Mis Pagos/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Nueva solicitud/i })).toBeInTheDocument();
    expect(screen.getByText(/No tienes pagos registrados/i)).toBeInTheDocument();
  });

  it('submits valid payment proof and shows success message', async () => {
    const submitPayment = vi.fn().mockResolvedValue({ id: 'pay1', status: 'PENDIENTE_APROBACION' });
    useOwnerPayments.mockReturnValue(defaultOwnerPaymentsHook({ submitPayment }));
    useApartments.mockReturnValue(defaultApartmentsHook());

    render(<OwnerPaymentsPage />);

    fireEvent.change(screen.getByLabelText(/Departamento/i), { target: { value: 'apt1' } });
    fireEvent.change(screen.getByLabelText(/Fecha de pago/i), { target: { value: '2026-05-15' } });
    fireEvent.change(screen.getByLabelText(/Monto/i), { target: { value: '500' } });

    const file = new File(['fake pdf content'], 'comprobante.pdf', { type: 'application/pdf' });
    const proofZone = screen.getByRole('button', { name: /Adjuntar comprobante/i });
    const input = proofZone.closest('div').parentElement.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [file] } });

    fireEvent.click(screen.getByRole('button', { name: /Enviar solicitud/i }));

    await waitFor(() => {
      expect(submitPayment).toHaveBeenCalledTimes(1);
    });

    const submittedForm = submitPayment.mock.calls[0][0];
    expect(submittedForm).toBeInstanceOf(FormData);
    expect(submittedForm.get('apartment_id')).toBe('apt1');
    expect(submittedForm.get('paid_at')).toBe('2026-05-15');
    expect(submittedForm.get('amount')).toBe('500');
    expect(submittedForm.get('proof_file')).toBe(file);

    await waitFor(() => {
      expect(screen.getByText(/Solicitud de pago enviada correctamente/i)).toBeInTheDocument();
    });
  });

  it('shows rejection reason when payment is RECHAZADO', () => {
    const payments = [
      {
        id: 'pay1',
        period: '2026-05',
        apartment_code: '101',
        paid_at: '2026-05-15',
        amount: 500,
        status: 'RECHAZADO',
        rejection_reason: 'Comprobante ilegible',
      },
    ];
    useOwnerPayments.mockReturnValue(defaultOwnerPaymentsHook({ payments }));
    useApartments.mockReturnValue(defaultApartmentsHook());

    render(<OwnerPaymentsPage />);

    expect(screen.getByText('Rechazado')).toBeInTheDocument();
    expect(screen.getByText('Comprobante ilegible')).toBeInTheDocument();
  });

  it('disables receipt button when payment is not approved', () => {
    const payments = [
      {
        id: 'pay1',
        period: '2026-05',
        apartment_code: '101',
        paid_at: '2026-05-15',
        amount: 500,
        status: 'PENDIENTE_APROBACION',
        rejection_reason: null,
      },
    ];
    useOwnerPayments.mockReturnValue(defaultOwnerPaymentsHook({ payments }));
    useApartments.mockReturnValue(defaultApartmentsHook());

    render(<OwnerPaymentsPage />);

    const receiptBtn = screen.getByRole('button', { name: /Recibo oficial/i });
    expect(receiptBtn).toBeDisabled();
  });

  it('enables receipt button when payment is approved', () => {
    const payments = [
      {
        id: 'pay1',
        period: '2026-05',
        apartment_code: '101',
        paid_at: '2026-05-15',
        amount: 500,
        status: 'REGISTRADO',
        rejection_reason: null,
      },
    ];
    useOwnerPayments.mockReturnValue(defaultOwnerPaymentsHook({ payments }));
    useApartments.mockReturnValue(defaultApartmentsHook());

    render(<OwnerPaymentsPage />);

    const receiptBtn = screen.getByRole('button', { name: /Recibo oficial/i });
    expect(receiptBtn).not.toBeDisabled();
  });
});

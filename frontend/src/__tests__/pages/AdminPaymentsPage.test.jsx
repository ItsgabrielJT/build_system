import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminPaymentsPage from '../../pages/admin/AdminPaymentsPage';
import { usePayments } from '../../hooks/usePayments';
import { useAdminPaymentReview } from '../../hooks/useAdminPaymentReview';
import { useApartments } from '../../hooks/useApartments';
import { useOwners } from '../../hooks/useOwners';

vi.mock('../../hooks/usePayments', () => ({ usePayments: vi.fn() }));
vi.mock('../../hooks/useAdminPaymentReview', () => ({ useAdminPaymentReview: vi.fn() }));
vi.mock('../../hooks/useApartments', () => ({ useApartments: vi.fn() }));
vi.mock('../../hooks/useOwners', () => ({ useOwners: vi.fn() }));
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    token: 'test-token',
    user: { id: 'user1' },
    role: 'ADMIN',
  }),
}));

describe('AdminPaymentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filtra pagos por periodo', async () => {
    const fetchPayments = vi.fn();
    const fetchPending = vi.fn();
    const fetchApartments = vi.fn();
    const fetchOwners = vi.fn();

    usePayments.mockReturnValue({
      payments: [],
      loading: false,
      error: null,
      fetchPayments,
      createPayment: vi.fn(),
      annulPayment: vi.fn(),
    });

    useAdminPaymentReview.mockReturnValue({
      pendingPayments: [],
      loading: false,
      error: null,
      fetchPending,
      approvePayment: vi.fn(),
      rejectPayment: vi.fn(),
    });

    useApartments.mockReturnValue({
      apartments: [],
      loading: false,
      error: null,
      fetchApartments,
    });

    useOwners.mockReturnValue({
      owners: [],
      loading: false,
      error: null,
      fetchOwners,
    });

    const { container } = render(<AdminPaymentsPage />);

    await waitFor(() => {
      expect(fetchApartments).toHaveBeenCalledTimes(1);
      expect(fetchOwners).toHaveBeenCalledTimes(1);
      expect(fetchPending).toHaveBeenCalledTimes(1);
      expect(fetchPayments).toHaveBeenCalledWith({});
    });

    const periodInput = container.querySelector('input[type="month"]');
    expect(periodInput).not.toBeNull();
    fireEvent.change(periodInput, { target: { value: '2026-05' } });

    await waitFor(() => {
      expect(fetchPayments).toHaveBeenCalledWith({ period: '2026-05' });
    });
  });

  it('pre-carga el período con el mes actual al abrir formulario', async () => {
    const fetchPayments = vi.fn();
    const fetchPending = vi.fn();
    const fetchApartments = vi.fn();
    const fetchOwners = vi.fn();

    usePayments.mockReturnValue({
      payments: [],
      loading: false,
      error: null,
      fetchPayments,
      createPayment: vi.fn(),
      annulPayment: vi.fn(),
    });

    useAdminPaymentReview.mockReturnValue({
      pendingPayments: [],
      loading: false,
      error: null,
      fetchPending,
      approvePayment: vi.fn(),
      rejectPayment: vi.fn(),
    });

    useApartments.mockReturnValue({
      apartments: [
        { id: 'apt1', code: '101', owner_id: 'owner1', owner_name: 'Juan', owner_email: 'juan@test.com' },
      ],
      loading: false,
      error: null,
      fetchApartments,
    });

    useOwners.mockReturnValue({
      owners: [
        { id: 'owner1', full_name: 'Juan', document_id: '123' },
      ],
      loading: false,
      error: null,
      fetchOwners,
    });

    render(<AdminPaymentsPage />);

    // Abrir formulario
    const addButton = screen.getByRole('button', { name: /Registrar pago/i });
    fireEvent.click(addButton);

    // Obtener mes actual esperado
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    // Buscar el input de período (es un input de tipo month en el FormModal)
    await waitFor(() => {
      const periodInputs = screen.getAllByDisplayValue(currentMonth);
      expect(periodInputs.length).toBeGreaterThan(0);
    });
  });

  it('auto-carga el propietario al seleccionar departamento con propietario', async () => {
    const fetchPayments = vi.fn();
    const fetchPending = vi.fn();
    const fetchApartments = vi.fn();
    const fetchOwners = vi.fn();

    usePayments.mockReturnValue({
      payments: [],
      loading: false,
      error: null,
      fetchPayments,
      createPayment: vi.fn(),
      annulPayment: vi.fn(),
    });

    useAdminPaymentReview.mockReturnValue({
      pendingPayments: [],
      loading: false,
      error: null,
      fetchPending,
      approvePayment: vi.fn(),
      rejectPayment: vi.fn(),
    });

    useApartments.mockReturnValue({
      apartments: [
        { id: 'apt1', code: '101', owner_id: 'owner1', owner_name: 'Juan', owner_email: 'juan@test.com' },
        { id: 'apt2', code: '102', owner_id: null, owner_name: null, owner_email: null },
      ],
      loading: false,
      error: null,
      fetchApartments,
    });

    useOwners.mockReturnValue({
      owners: [
        { id: 'owner1', full_name: 'Juan', document_id: '123' },
      ],
      loading: false,
      error: null,
      fetchOwners,
    });

    render(<AdminPaymentsPage />);

    // Abrir formulario
    const addButton = screen.getByRole('button', { name: /Registrar pago/i });
    fireEvent.click(addButton);

    // Seleccionar apartamento con propietario
    await waitFor(() => {
      const apartmentSelects = screen.queryAllByLabelText(/Departamento/i);
      expect(apartmentSelects.length).toBeGreaterThan(0);
    });

    const apartmentSelect = screen.getByLabelText(/Departamento/i);
    fireEvent.change(apartmentSelect, { target: { value: 'apt1' } });

    // Verificar que el propietario se auto-cargó
    await waitFor(() => {
      const ownerSelect = screen.getByLabelText(/Propietario/i);
      expect(ownerSelect).toHaveValue('owner1');
    });
  });

  it('carga y renderiza pagos pendientes en la sección administrativa', async () => {
    const fetchPayments = vi.fn();
    const fetchPending = vi.fn();

    usePayments.mockReturnValue({
      payments: [],
      loading: false,
      error: null,
      fetchPayments,
      createPayment: vi.fn(),
      annulPayment: vi.fn(),
    });

    useAdminPaymentReview.mockReturnValue({
      pendingPayments: [
        {
          id: 'pending-1',
          apartment_code: 'A-101',
          owner_name: 'Ana Lopez',
          period: '2026-05',
          amount: 500,
          paid_at: '2026-05-20',
          proof_file_name: 'transferencia.pdf',
        },
      ],
      loading: false,
      error: null,
      fetchPending,
      approvePayment: vi.fn(),
      rejectPayment: vi.fn(),
    });

    useApartments.mockReturnValue({ apartments: [], loading: false, error: null, fetchApartments: vi.fn() });
    useOwners.mockReturnValue({ owners: [], loading: false, error: null, fetchOwners: vi.fn() });

    render(<AdminPaymentsPage />);

    await waitFor(() => {
      expect(fetchPending).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole('heading', { name: /Pendientes de aprobación/i })).toBeInTheDocument();
    expect(screen.getByText(/Unidad A-101/i)).toBeInTheDocument();
    expect(screen.getByText(/Ana Lopez/i)).toBeInTheDocument();
    expect(screen.getByText(/transferencia\.pdf/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Revisar/i })).toBeInTheDocument();
  });

  it('abre revisión y aprueba un pago pendiente', async () => {
    const user = userEvent.setup();
    const approvePayment = vi.fn().mockResolvedValue({ id: 'pending-2', status: 'APROBADO' });

    usePayments.mockReturnValue({
      payments: [],
      loading: false,
      error: null,
      fetchPayments: vi.fn(),
      createPayment: vi.fn(),
      annulPayment: vi.fn(),
    });

    useAdminPaymentReview.mockReturnValue({
      pendingPayments: [
        {
          id: 'pending-2',
          apartment_code: 'B-202',
          owner_name: 'Carlos Ruiz',
          period: '2026-05',
          amount: 750,
          paid_at: '2026-05-22',
          proof_file_name: 'comprobante.png',
          method: 'transferencia',
        },
      ],
      loading: false,
      error: null,
      fetchPending: vi.fn(),
      approvePayment,
      rejectPayment: vi.fn(),
    });

    useApartments.mockReturnValue({ apartments: [], loading: false, error: null, fetchApartments: vi.fn() });
    useOwners.mockReturnValue({ owners: [], loading: false, error: null, fetchOwners: vi.fn() });

    render(<AdminPaymentsPage />);

    await user.click(screen.getByRole('button', { name: /Revisar/i }));
    expect(screen.getByRole('heading', { name: /Revisar Pago Pendiente/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Aprobar' }));

    await waitFor(() => {
      expect(approvePayment).toHaveBeenCalledWith('pending-2');
    });
  });

  it('abre revisión y rechaza un pago pendiente con motivo', async () => {
    const user = userEvent.setup();
    const rejectPayment = vi.fn().mockResolvedValue({ id: 'pending-3', status: 'RECHAZADO' });

    usePayments.mockReturnValue({
      payments: [],
      loading: false,
      error: null,
      fetchPayments: vi.fn(),
      createPayment: vi.fn(),
      annulPayment: vi.fn(),
    });

    useAdminPaymentReview.mockReturnValue({
      pendingPayments: [
        {
          id: 'pending-3',
          apartment_code: 'C-303',
          owner_name: 'Mariana Diaz',
          period: '2026-05',
          amount: 980,
          paid_at: '2026-05-25',
          proof_file_name: 'voucher.pdf',
        },
      ],
      loading: false,
      error: null,
      fetchPending: vi.fn(),
      approvePayment: vi.fn(),
      rejectPayment,
    });

    useApartments.mockReturnValue({ apartments: [], loading: false, error: null, fetchApartments: vi.fn() });
    useOwners.mockReturnValue({ owners: [], loading: false, error: null, fetchOwners: vi.fn() });

    render(<AdminPaymentsPage />);

    await user.click(screen.getByRole('button', { name: /Revisar/i }));
    await user.click(screen.getByRole('button', { name: 'Rechazar' }));
    await user.type(screen.getByLabelText(/Motivo de rechazo/i), 'Comprobante ilegible');
    await user.click(screen.getByRole('button', { name: 'Confirmar rechazo' }));

    await waitFor(() => {
      expect(rejectPayment).toHaveBeenCalledWith('pending-3', 'Comprobante ilegible');
    });
  });
});

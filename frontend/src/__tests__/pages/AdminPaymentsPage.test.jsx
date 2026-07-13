import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminPaymentsPage from '../../pages/admin/AdminPaymentsPage';
import { usePayments } from '../../hooks/usePayments';
import { useAdminPaymentReview } from '../../hooks/useAdminPaymentReview';
import { useApartments } from '../../hooks/useApartments';
import { useOwners } from '../../hooks/useOwners';
import { getApartmentPendingDebts } from '../../services/apartmentService';

vi.mock('../../hooks/usePayments', () => ({ usePayments: vi.fn() }));
vi.mock('../../hooks/useAdminPaymentReview', () => ({ useAdminPaymentReview: vi.fn() }));
vi.mock('../../hooks/useApartments', () => ({ useApartments: vi.fn() }));
vi.mock('../../hooks/useOwners', () => ({ useOwners: vi.fn() }));
vi.mock('../../services/apartmentService', () => ({
  getApartmentPendingDebts: vi.fn(),
}));
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    token: 'test-token',
    user: { id: 'user1' },
    role: 'ADMIN',
  }),
}));vi.mock('../../context/NotificationContext', () => ({
  useNotification: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

function currentPeriod() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
}

function currentMonthDate(day) {
  return `${currentPeriod()}-${String(day).padStart(2, '0')}`;
}

describe('AdminPaymentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getApartmentPendingDebts.mockResolvedValue({ cuotas: [], multas: [] });
  });

  it('filtra pagos por rango de fechas', async () => {
    const fetchPayments = vi.fn();
    const fetchPending = vi.fn();
    const fetchApartments = vi.fn();
    const fetchOwners = vi.fn();

    usePayments.mockReturnValue({
      payments: [
        {
          id: 'pay-1',
          period: currentPeriod(),
          apartment_code: '101',
          owner_name: 'Ana Ruiz',
          amount: 120,
          method: 'transferencia',
          paid_at: currentMonthDate(10),
          status: 'REGISTRADO',
          reference: 'TRX-1',
        },
        {
          id: 'pay-2',
          period: currentPeriod(),
          apartment_code: '202',
          owner_name: 'Luis Mora',
          amount: 95,
          method: 'efectivo',
          paid_at: currentMonthDate(20),
          status: 'REGISTRADO',
          reference: 'REC-2',
        },
      ],
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
      downloadProof: vi.fn(),
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

    expect(screen.getByText('Ana Ruiz')).toBeInTheDocument();
    expect(screen.getByText('Luis Mora')).toBeInTheDocument();

    const [startDateInput, endDateInput] = container.querySelectorAll('input[type="date"]');
    expect(startDateInput).not.toBeNull();
    expect(endDateInput).not.toBeNull();
    fireEvent.change(startDateInput, { target: { value: currentMonthDate(15) } });
    fireEvent.change(endDateInput, { target: { value: currentMonthDate(28) } });

    expect(screen.queryByText('Ana Ruiz')).not.toBeInTheDocument();
    expect(screen.getByText('Luis Mora')).toBeInTheDocument();
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
      downloadProof: vi.fn(),
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
      downloadProof: vi.fn(),
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

  it('registra una cuota sin enviar fine_id vacío', async () => {
    const user = userEvent.setup();
    const fetchPayments = vi.fn();
    const fetchPending = vi.fn();
    const fetchApartments = vi.fn();
    const fetchOwners = vi.fn();
    const createPayment = vi.fn().mockResolvedValue({ id: 'pay-created' });

    usePayments.mockReturnValue({
      payments: [],
      loading: false,
      error: null,
      fetchPayments,
      createPayment,
      annulPayment: vi.fn(),
    });

    useAdminPaymentReview.mockReturnValue({
      pendingPayments: [],
      loading: false,
      error: null,
      fetchPending,
      approvePayment: vi.fn(),
      rejectPayment: vi.fn(),
      downloadProof: vi.fn(),
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

    await user.click(screen.getByRole('button', { name: /Registrar pago/i }));
    await user.selectOptions(screen.getByLabelText(/Departamento/i), 'apt1');
    await user.clear(screen.getByLabelText(/Monto/i));
    await user.type(screen.getByLabelText(/Monto/i), '125.50');
    await user.type(screen.getByLabelText(/Fecha de pago/i), `${currentPeriod()}-15`);
    await user.click(screen.getByRole('button', { name: /^Guardar$/i }));

    await waitFor(() => {
      expect(createPayment).toHaveBeenCalledTimes(1);
    });

    expect(createPayment).toHaveBeenCalledWith(expect.not.objectContaining({ fine_id: '' }));
    expect(createPayment).toHaveBeenCalledWith(expect.objectContaining({
      apartment_id: 'apt1',
      owner_id: 'owner1',
      amount: 125.5,
    }));
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
      downloadProof: vi.fn(),
    });

    useApartments.mockReturnValue({ apartments: [], loading: false, error: null, fetchApartments: vi.fn() });
    useOwners.mockReturnValue({ owners: [], loading: false, error: null, fetchOwners: vi.fn() });

    render(<AdminPaymentsPage />);

    await waitFor(() => {
      expect(fetchPending).toHaveBeenCalledTimes(1);
    });

    await userEvent.click(screen.getByRole('tab', { name: /Aprobaciones/i }));

    expect(screen.getByRole('heading', { name: /Pendientes de aprobación/i })).toBeInTheDocument();
    expect(screen.getByText(/Unidad A-101/i)).toBeInTheDocument();
    expect(screen.getByText(/Ana Lopez/i)).toBeInTheDocument();
    expect(screen.getByText(/transferencia\.pdf/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Revisar/i })).toBeInTheDocument();
  });

  it('pagina los pagos pendientes y el historial de pagos', async () => {
    const pendingPayments = Array.from({ length: 6 }, (_, index) => ({
      id: `pending-${index + 1}`,
      apartment_code: `A-10${index + 1}`,
      owner_name: `Owner ${index + 1}`,
      period: currentPeriod(),
      amount: 100 + index,
      proof_file_name: `proof-${index + 1}.pdf`,
    }));
    const payments = Array.from({ length: 6 }, (_, index) => ({
      id: `payment-${index + 1}`,
      apartment_code: `B-20${index + 1}`,
      owner_name: `Resident ${index + 1}`,
      period: currentPeriod(),
      amount: 300 + index,
      method: 'transferencia',
      paid_at: currentMonthDate(20),
      reference: `REF-${index + 1}`,
      status: 'REGISTRADO',
    }));

    usePayments.mockReturnValue({
      payments,
      loading: false,
      error: null,
      fetchPayments: vi.fn(),
      createPayment: vi.fn(),
      annulPayment: vi.fn(),
    });

    useAdminPaymentReview.mockReturnValue({
      pendingPayments,
      loading: false,
      error: null,
      fetchPending: vi.fn(),
      approvePayment: vi.fn(),
      rejectPayment: vi.fn(),
      downloadProof: vi.fn(),
    });

    useApartments.mockReturnValue({ apartments: [], loading: false, error: null, fetchApartments: vi.fn() });
    useOwners.mockReturnValue({ owners: [], loading: false, error: null, fetchOwners: vi.fn() });

    const user = userEvent.setup();
    render(<AdminPaymentsPage />);

    const overviewPanel = screen.getByRole('tabpanel', { name: /Resumen y pagos/i });
    const historyTable = within(overviewPanel).getAllByRole('table')[0];

    expect(within(historyTable).getByText(/Unidad B-201/i)).toBeInTheDocument();
    expect(within(historyTable).queryByText(/Unidad B-206/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Siguiente/i }));

    expect(within(historyTable).getByText(/Unidad B-206/i)).toBeInTheDocument();
    expect(within(historyTable).queryByText(/Unidad B-201/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Aprobaciones/i }));

    const approvalsPanel = screen.getByRole('tabpanel', { name: /Aprobaciones/i });
    const approvalsTable = within(approvalsPanel).getByRole('table');

    expect(within(approvalsTable).getByText(/Unidad A-101/i)).toBeInTheDocument();
    expect(within(approvalsTable).queryByText(/Unidad A-106/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Siguiente/i }));

    expect(within(approvalsTable).getByText(/Unidad A-106/i)).toBeInTheDocument();
    expect(within(approvalsTable).queryByText(/Unidad A-101/i)).not.toBeInTheDocument();
  });

  it('permite eliminar solo pagos anulados desde el historial', async () => {
    const user = userEvent.setup();
    const deletePayment = vi.fn().mockResolvedValue();
    const fetchPayments = vi.fn();

    usePayments.mockReturnValue({
      payments: [
        {
          id: 'payment-active',
          apartment_code: 'A-100',
          owner_name: 'Pago Activo',
          period: currentPeriod(),
          amount: 120,
          method: 'transferencia',
          paid_at: currentMonthDate(10),
          reference: 'ACT-1',
          status: 'REGISTRADO',
        },
        {
          id: 'payment-annulled',
          apartment_code: 'A-200',
          owner_name: 'Pago Anulado',
          period: currentPeriod(),
          amount: 80,
          method: 'efectivo',
          paid_at: currentMonthDate(12),
          reference: 'ANU-1',
          status: 'ANULADO',
        },
      ],
      loading: false,
      error: null,
      fetchPayments,
      createPayment: vi.fn(),
      annulPayment: vi.fn(),
      deletePayment,
      downloadAdminReceipt: vi.fn(),
    });

    useAdminPaymentReview.mockReturnValue({
      pendingPayments: [],
      loading: false,
      error: null,
      fetchPending: vi.fn(),
      approvePayment: vi.fn(),
      rejectPayment: vi.fn(),
      downloadProof: vi.fn(),
    });

    useApartments.mockReturnValue({ apartments: [], loading: false, error: null, fetchApartments: vi.fn() });
    useOwners.mockReturnValue({ owners: [], loading: false, error: null, fetchOwners: vi.fn() });

    render(<AdminPaymentsPage />);

    const overviewPanel = screen.getByRole('tabpanel', { name: /Resumen y pagos/i });
    const activeRow = within(overviewPanel).getByText('Pago Activo').closest('tr');
    const annulledRow = within(overviewPanel).getByText('Pago Anulado').closest('tr');

    expect(within(activeRow).queryByRole('button', { name: /Eliminar/i })).not.toBeInTheDocument();
    await user.click(within(annulledRow).getByRole('button', { name: /Eliminar/i }));
    const confirmButtons = screen.getAllByRole('button', { name: /^Eliminar$/i });
    await user.click(confirmButtons.at(-1));

    await waitFor(() => {
      expect(deletePayment).toHaveBeenCalledWith('payment-annulled');
    });
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
      downloadProof: vi.fn(),
    });

    useApartments.mockReturnValue({ apartments: [], loading: false, error: null, fetchApartments: vi.fn() });
    useOwners.mockReturnValue({ owners: [], loading: false, error: null, fetchOwners: vi.fn() });

    render(<AdminPaymentsPage />);

    await user.click(screen.getByRole('tab', { name: /Aprobaciones/i }));
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
      downloadProof: vi.fn(),
    });

    useApartments.mockReturnValue({ apartments: [], loading: false, error: null, fetchApartments: vi.fn() });
    useOwners.mockReturnValue({ owners: [], loading: false, error: null, fetchOwners: vi.fn() });

    render(<AdminPaymentsPage />);

    await user.click(screen.getByRole('tab', { name: /Aprobaciones/i }));
    await user.click(screen.getByRole('button', { name: /Revisar/i }));
    await user.click(screen.getByRole('button', { name: 'Rechazar' }));
    await user.type(screen.getByLabelText(/Motivo de rechazo/i), 'Comprobante ilegible');
    await user.click(screen.getByRole('button', { name: 'Confirmar rechazo' }));

    await waitFor(() => {
      expect(rejectPayment).toHaveBeenCalledWith('pending-3', 'Comprobante ilegible');
    });
  });

  it('permite descargar el comprobante desde la revisión', async () => {
    const user = userEvent.setup();
    const downloadProof = vi.fn().mockResolvedValue(new Blob(['pdf']));

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
          id: 'pending-4',
          apartment_code: 'D-404',
          owner_name: 'Lucia Mora',
          period: '2026-05',
          amount: 640,
          paid_at: '2026-05-25',
          proof_file_name: 'pago.pdf',
        },
      ],
      loading: false,
      error: null,
      fetchPending: vi.fn(),
      approvePayment: vi.fn(),
      rejectPayment: vi.fn(),
      downloadProof,
    });

    useApartments.mockReturnValue({ apartments: [], loading: false, error: null, fetchApartments: vi.fn() });
    useOwners.mockReturnValue({ owners: [], loading: false, error: null, fetchOwners: vi.fn() });

    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'a') {
        return {
          click: clickSpy,
          set href(value) { this._href = value; },
          get href() { return this._href; },
          set download(value) { this._download = value; },
          get download() { return this._download; },
        };
      }
      return originalCreateElement(tagName);
    });

    render(<AdminPaymentsPage />);

  await user.click(screen.getByRole('tab', { name: /Aprobaciones/i }));
    await user.click(screen.getByRole('button', { name: /Revisar/i }));
    await user.click(screen.getByRole('button', { name: /Descargar comprobante/i }));

    await waitFor(() => {
      expect(downloadProof).toHaveBeenCalledWith('pending-4');
      expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
    createElementSpy.mockRestore();
  });
});

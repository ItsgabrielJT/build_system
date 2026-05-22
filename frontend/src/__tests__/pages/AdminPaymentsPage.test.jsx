import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminPaymentsPage from '../../pages/admin/AdminPaymentsPage';
import { usePayments } from '../../hooks/usePayments';
import { useApartments } from '../../hooks/useApartments';
import { useOwners } from '../../hooks/useOwners';

vi.mock('../../hooks/usePayments', () => ({ usePayments: vi.fn() }));
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
});

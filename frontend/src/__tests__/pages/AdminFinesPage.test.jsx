import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminFinesPage from '../../pages/admin/AdminFinesPage';
import { useFines } from '../../hooks/useFines';
import { useApartments } from '../../hooks/useApartments';
import { useOwners } from '../../hooks/useOwners';

vi.mock('../../hooks/useFines', () => ({ useFines: vi.fn() }));
vi.mock('../../hooks/useApartments', () => ({ useApartments: vi.fn() }));
vi.mock('../../hooks/useOwners', () => ({ useOwners: vi.fn() }));
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    token: 'test-token',
    user: { id: 'user1' },
    role: 'ADMIN',
  }),
}));

describe('AdminFinesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pre-carga el período con el mes actual al abrir formulario', async () => {
    const user = userEvent.setup();
    const fetchFines = vi.fn();
    const fetchApartments = vi.fn();
    const fetchOwners = vi.fn();

    useFines.mockReturnValue({
      fines: [],
      loading: false,
      error: null,
      fetchFines,
      createFine: vi.fn(),
      annulFine: vi.fn(),
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

    render(<AdminFinesPage />);

    // Abrir formulario
    const addButton = screen.getByRole('button', { name: /Registrar multa/i });
    await user.click(addButton);

    // Obtener mes actual esperado
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    // Buscar el input de período
    await waitFor(() => {
      const periodInputs = screen.getAllByDisplayValue(currentMonth);
      expect(periodInputs.length).toBeGreaterThan(0);
    });
  });

  it('auto-carga el propietario al seleccionar departamento con propietario', async () => {
    const user = userEvent.setup();
    const fetchFines = vi.fn();
    const fetchApartments = vi.fn();
    const fetchOwners = vi.fn();

    useFines.mockReturnValue({
      fines: [],
      loading: false,
      error: null,
      fetchFines,
      createFine: vi.fn(),
      annulFine: vi.fn(),
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

    render(<AdminFinesPage />);

    // Abrir formulario
    const addButton = screen.getByRole('button', { name: /Registrar multa/i });
    await user.click(addButton);

    // Seleccionar apartamento con propietario
    await waitFor(() => {
      const apartmentSelects = screen.queryAllByLabelText('Departamento');
      expect(apartmentSelects.length).toBeGreaterThan(0);
    });

    const apartmentSelect = screen.getByLabelText('Departamento');
    await user.selectOption(apartmentSelect, 'apt1');

    // Verificar que el propietario se auto-cargó
    await waitFor(() => {
      const ownerSelect = screen.getByLabelText('Propietario');
      expect(ownerSelect).toHaveValue('owner1');
    });
  });

  it('filtra departamentos al seleccionar propietario', async () => {
    const user = userEvent.setup();
    const fetchFines = vi.fn();
    const fetchApartments = vi.fn();
    const fetchOwners = vi.fn();

    useFines.mockReturnValue({
      fines: [],
      loading: false,
      error: null,
      fetchFines,
      createFine: vi.fn(),
      annulFine: vi.fn(),
    });

    useApartments.mockReturnValue({
      apartments: [
        { id: 'apt1', code: '101', owner_id: 'owner1', owner_name: 'Juan', owner_email: 'juan@test.com' },
        { id: 'apt2', code: '102', owner_id: 'owner2', owner_name: 'María', owner_email: 'maria@test.com' },
      ],
      loading: false,
      error: null,
      fetchApartments,
    });

    useOwners.mockReturnValue({
      owners: [
        { id: 'owner1', full_name: 'Juan', document_id: '123' },
        { id: 'owner2', full_name: 'María', document_id: '456' },
      ],
      loading: false,
      error: null,
      fetchOwners,
    });

    render(<AdminFinesPage />);

    // Abrir formulario
    const addButton = screen.getByRole('button', { name: /Registrar multa/i });
    await user.click(addButton);

    // Seleccionar propietario 'owner1'
    await waitFor(() => {
      const ownerSelects = screen.queryAllByLabelText('Propietario');
      expect(ownerSelects.length).toBeGreaterThan(0);
    });

    const ownerSelect = screen.getByLabelText('Propietario');
    await user.selectOption(ownerSelect, 'owner1');

    // Verificar que solo muestra apartamentos de owner1
    await waitFor(() => {
      const apartmentSelect = screen.getByLabelText('Departamento');
      const options = Array.from(apartmentSelect.options);
      const labels = options.map(opt => opt.text);
      
      expect(labels).toContain('Depto 101');
    });
  });
});

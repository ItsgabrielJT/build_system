import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminApartmentsPage from '../../pages/admin/AdminApartmentsPage';
import { useApartments } from '../../hooks/useApartments';
import { useOwners } from '../../hooks/useOwners';
import { useBuilding } from '../../hooks/useBuilding';

vi.mock('../../hooks/useApartments', () => ({ useApartments: vi.fn() }));
vi.mock('../../hooks/useOwners', () => ({ useOwners: vi.fn() }));
vi.mock('../../hooks/useBuilding', () => ({ useBuilding: vi.fn() }));
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    token: 'test-token',
    user: { id: 'user1' },
    role: 'ADMIN',
  }),
}));

describe('AdminApartmentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra el nombre del propietario en la tabla', async () => {
    const fetchApartments = vi.fn();
    const fetchOwners = vi.fn();
    const fetchBuilding = vi.fn();

    useApartments.mockReturnValue({
      apartments: [
        { 
          id: 'apt1', 
          code: '101', 
          floor: 1,
          tower: 'A',
          status: 'ACTIVO',
          owner_name: 'Juan Perez',
          owner_email: 'juan@test.com',
          owners: []
        },
        { 
          id: 'apt2', 
          code: '102', 
          floor: 1,
          tower: 'A',
          status: 'ACTIVO',
          owner_name: null,
          owner_email: null,
          owners: []
        },
      ],
      loading: false,
      error: null,
      fetchApartments,
      createApartment: vi.fn(),
      assignOwner: vi.fn(),
      removeOwner: vi.fn(),
    });

    useOwners.mockReturnValue({
      owners: [],
      loading: false,
      error: null,
      fetchOwners,
    });

    useBuilding.mockReturnValue({
      building: { id: 'b1', name: 'Edificio A' },
      loading: false,
      error: null,
      fetchBuilding,
      updateBuilding: vi.fn(),
    });

    render(<AdminApartmentsPage />);

    await waitFor(() => {
      expect(screen.getByText('Juan Perez')).toBeInTheDocument();
      expect(screen.getByText('juan@test.com')).toBeInTheDocument();
    });
  });

  it('muestra "Sin asignar" para departamentos sin propietario', async () => {
    const fetchApartments = vi.fn();
    const fetchOwners = vi.fn();
    const fetchBuilding = vi.fn();

    useApartments.mockReturnValue({
      apartments: [
        { 
          id: 'apt1', 
          code: '101', 
          floor: 1,
          tower: 'A',
          status: 'ACTIVO',
          owner_name: null,
          owner_email: null,
          owners: []
        },
      ],
      loading: false,
      error: null,
      fetchApartments,
      createApartment: vi.fn(),
      assignOwner: vi.fn(),
      removeOwner: vi.fn(),
    });

    useOwners.mockReturnValue({
      owners: [],
      loading: false,
      error: null,
      fetchOwners,
    });

    useBuilding.mockReturnValue({
      building: { id: 'b1', name: 'Edificio A' },
      loading: false,
      error: null,
      fetchBuilding,
      updateBuilding: vi.fn(),
    });

    render(<AdminApartmentsPage />);

    await waitFor(() => {
      // Debería haber al menos una celda con "Sin asignar"
      const cells = screen.getAllByText('Sin asignar');
      expect(cells.length).toBeGreaterThan(0);
    });
  });

  it('abre el modal de editar edificio al hacer click en botón', async () => {
    const user = userEvent.setup();
    const fetchApartments = vi.fn();
    const fetchOwners = vi.fn();
    const fetchBuilding = vi.fn();

    useApartments.mockReturnValue({
      apartments: [],
      loading: false,
      error: null,
      fetchApartments,
      createApartment: vi.fn(),
      assignOwner: vi.fn(),
      removeOwner: vi.fn(),
    });

    useOwners.mockReturnValue({
      owners: [],
      loading: false,
      error: null,
      fetchOwners,
    });

    useBuilding.mockReturnValue({
      building: { id: 'b1', name: 'Edificio A', address: 'Calle 1', phone: '123', email: 'test@test.com' },
      loading: false,
      error: null,
      fetchBuilding,
      updateBuilding: vi.fn(),
    });

    render(<AdminApartmentsPage />);

    // Encontrar y hacer click en el botón de editar edificio
    const editBuildingButton = screen.getByRole('button', { name: /Editar Edificio/i });
    await user.click(editBuildingButton);

    // Verificar que el modal se abrió (debería mostrar el título)
    await waitFor(() => {
      expect(screen.getByText('Editar Información del Edificio')).toBeInTheDocument();
    });
  });

  it('carga información del edificio al montar el componente', async () => {
    const fetchApartments = vi.fn();
    const fetchOwners = vi.fn();
    const fetchBuilding = vi.fn();

    useApartments.mockReturnValue({
      apartments: [],
      loading: false,
      error: null,
      fetchApartments,
      createApartment: vi.fn(),
      assignOwner: vi.fn(),
      removeOwner: vi.fn(),
    });

    useOwners.mockReturnValue({
      owners: [],
      loading: false,
      error: null,
      fetchOwners,
    });

    useBuilding.mockReturnValue({
      building: null,
      loading: false,
      error: null,
      fetchBuilding,
      updateBuilding: vi.fn(),
    });

    render(<AdminApartmentsPage />);

    await waitFor(() => {
      expect(fetchBuilding).toHaveBeenCalledWith('default');
    });
  });
});

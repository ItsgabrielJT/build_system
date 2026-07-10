import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminEventsPage from '../../pages/admin/AdminEventsPage';
import { getEvents, createEvent, updateEvent, deleteEvent } from '../../services/eventService';
import { getOwners } from '../../services/ownerService';

vi.mock('../../services/eventService', () => ({
  getEvents: vi.fn(),
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
}));

vi.mock('../../services/ownerService', () => ({
  getOwners: vi.fn(),
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    token: 'test-token',
    user: { id: 'user1' },
    role: 'ADMIN',
  }),
}));

vi.mock('../../context/NotificationContext', () => ({
  useNotification: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('AdminEventsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders metrics cards, search filter, and list of events', async () => {
    const mockEvents = [
      {
        id: 'event-1',
        title: 'Reunión de Consorcio',
        description: 'Reunión mensual obligatoria',
        event_date: '2026-08-15',
        start_time: '18:00',
        end_time: '20:00',
        assigned_owners: [
          { id: 'owner-1', full_name: 'Gabriel Tates', email: 'gabriel@test.com' },
        ],
      },
    ];
    const mockOwners = [
      { id: 'owner-1', full_name: 'Gabriel Tates', email: 'gabriel@test.com' },
      { id: 'owner-2', full_name: 'Ana Pérez', email: 'ana@test.com' },
    ];

    getEvents.mockResolvedValue(mockEvents);
    getOwners.mockResolvedValue(mockOwners);

    render(<AdminEventsPage />);

    // Check loading state / list rendered
    await waitFor(() => {
      expect(screen.getByText('Reunión de Consorcio')).toBeInTheDocument();
      expect(screen.getByText('Reunión mensual obligatoria')).toBeInTheDocument();
      expect(screen.getByText('Gabriel Tates')).toBeInTheDocument();
    });

    // Check header and breadcrumb
    expect(screen.getByText('Admin / Eventos')).toBeInTheDocument();
    expect(screen.getByText('Gestión de Eventos')).toBeInTheDocument();

    // Check metrics cards
    expect(screen.getByText('Total eventos')).toBeInTheDocument();
    expect(screen.getByText('Eventos futuros')).toBeInTheDocument();
    expect(screen.getByText('Este mes')).toBeInTheDocument();
  });

  it('filters list based on search query', async () => {
    const mockEvents = [
      {
        id: 'event-1',
        title: 'Mantenimiento Ascensor',
        description: 'Piso 3',
        event_date: '2026-08-15',
        start_time: '09:00',
        end_time: '11:00',
        assigned_owners: [],
      },
      {
        id: 'event-2',
        title: 'Fiesta de Fin de Año',
        description: 'Salón de eventos',
        event_date: '2026-12-15',
        start_time: '20:00',
        end_time: '23:30',
        assigned_owners: [],
      },
    ];

    getEvents.mockResolvedValue(mockEvents);
    getOwners.mockResolvedValue([]);

    render(<AdminEventsPage />);

    await waitFor(() => {
      expect(screen.getByText('Mantenimiento Ascensor')).toBeInTheDocument();
      expect(screen.getByText('Fiesta de Fin de Año')).toBeInTheDocument();
    });

    // Filter search
    const searchInput = screen.getByPlaceholderText(/Buscar por título, descripción u propietario.../i);
    fireEvent.change(searchInput, { target: { value: 'Fiesta' } });

    expect(screen.queryByText('Mantenimiento Ascensor')).not.toBeInTheDocument();
    expect(screen.getByText('Fiesta de Fin de Año')).toBeInTheDocument();
  });

  it('opens FormModal and allows creation of a new event', async () => {
    const mockOwners = [
      { id: 'owner-1', full_name: 'Gabriel Tates', email: 'gabriel@test.com' },
      { id: 'owner-2', full_name: 'Ana Pérez', email: 'ana@test.com' },
    ];
    getEvents.mockResolvedValue([]);
    getOwners.mockResolvedValue(mockOwners);
    createEvent.mockResolvedValue({ id: 'new-event' });

    render(<AdminEventsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /\+ Crear evento/i })).toBeInTheDocument();
    });

    // Open modal
    const createBtn = screen.getByRole('button', { name: /\+ Crear evento/i });
    fireEvent.click(createBtn);

    // Modal elements should be visible
    expect(screen.getByRole('heading', { name: /Crear nuevo evento/i })).toBeInTheDocument();

    // Fill inputs
    fireEvent.change(screen.getByLabelText(/Título/i), { target: { value: 'Nuevo Evento Test' } });
    fireEvent.change(screen.getByLabelText(/Descripción/i), { target: { value: 'Descripción de prueba' } });
    fireEvent.change(screen.getByLabelText(/Fecha/i), { target: { value: '2026-07-20' } });
    fireEvent.change(screen.getByLabelText(/Hora de inicio/i), { target: { value: '10:00' } });
    fireEvent.change(screen.getByLabelText(/Hora de fin/i), { target: { value: '11:30' } });

    fireEvent.click(screen.getByLabelText('Gabriel Tates'));
    fireEvent.click(screen.getByLabelText('Ana Pérez'));

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /Guardar/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createEvent).toHaveBeenCalledWith(
        {
          title: 'Nuevo Evento Test',
          description: 'Descripción de prueba',
          event_date: '2026-07-20',
          start_time: '10:00',
          end_time: '11:30',
          owner_ids: ['owner-1', 'owner-2'],
        },
        'test-token'
      );
    });
  });

  it('allows editing and deleting events', async () => {
    const mockEvents = [
      {
        id: 'event-1',
        title: 'Reunión de Consorcio',
        description: 'Reunión mensual',
        event_date: '2026-08-15',
        start_time: '18:00',
        end_time: '20:00',
        assigned_owners: [
          { id: 'owner-1', full_name: 'Gabriel Tates', email: 'gabriel@test.com' },
        ],
      },
    ];
    const mockOwners = [
      { id: 'owner-1', full_name: 'Gabriel Tates', email: 'gabriel@test.com' },
      { id: 'owner-2', full_name: 'Ana Pérez', email: 'ana@test.com' },
    ];
    getEvents.mockResolvedValue(mockEvents);
    getOwners.mockResolvedValue(mockOwners);
    updateEvent.mockResolvedValue({ id: 'event-1' });
    deleteEvent.mockResolvedValue();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<AdminEventsPage />);

    await waitFor(() => {
      expect(screen.getByText('Reunión de Consorcio')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Editar/i }));
    expect(screen.getByRole('heading', { name: /Editar evento/i })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Título/i), { target: { value: 'Reunión actualizada' } });
    fireEvent.click(screen.getByLabelText('Ana Pérez'));
    fireEvent.click(screen.getByRole('button', { name: /Guardar/i }));

    await waitFor(() => {
      expect(updateEvent).toHaveBeenCalledWith(
        'event-1',
        expect.objectContaining({
          title: 'Reunión actualizada',
          owner_ids: ['owner-1', 'owner-2'],
        }),
        'test-token'
      );
    });

    fireEvent.click(screen.getByRole('button', { name: /Eliminar/i }));
    await waitFor(() => {
      expect(deleteEvent).toHaveBeenCalledWith('event-1', 'test-token');
    });
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OwnerAnnouncementsPage from '../../pages/owner/OwnerAnnouncementsPage';
import { getOwnerAnnouncements } from '../../services/announcementService';
import { getMyEvents } from '../../services/eventService';

const toastError = vi.hoisted(() => vi.fn());

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    token: 'owner-token',
    role: 'PROPIETARIO',
  }),
}));

vi.mock('../../context/NotificationContext', () => ({
  useNotification: () => ({
    error: toastError,
  }),
}));

vi.mock('../../services/announcementService', () => ({
  getOwnerAnnouncements: vi.fn(),
}));

vi.mock('../../services/eventService', () => ({
  getMyEvents: vi.fn(),
}));

describe('OwnerAnnouncementsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the full selected announcement from owner APIs', async () => {
    getOwnerAnnouncements.mockResolvedValue([
      {
        id: 'ann-1',
        title: 'Convocatoria a asamblea',
        description: 'Orden del día:\n1. Informe de administración\n2. Presupuesto anual',
        created_at: '2026-07-10T10:00:00Z',
      },
    ]);
    getMyEvents.mockResolvedValue([
      {
        id: 'event-1',
        title: 'Mantenimiento de bombas',
        description: 'Intervención técnica programada.',
        event_date: '2026-07-18',
        start_time: '08:00',
        end_time: '10:00',
      },
    ]);

    render(
      <MemoryRouter initialEntries={['/owner/announcements?announcementId=ann-1']}>
        <OwnerAnnouncementsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText('Cargando avisos...')).not.toBeInTheDocument();
    });

    expect(screen.getAllByText('Convocatoria a asamblea')).toHaveLength(2);
    expect(screen.getByText('Orden del día:')).toBeInTheDocument();
    expect(screen.getByText('1. Informe de administración')).toBeInTheDocument();
    expect(screen.getByText('2. Presupuesto anual')).toBeInTheDocument();
    expect(screen.getByText('Mantenimiento de bombas')).toBeInTheDocument();
    expect(getOwnerAnnouncements).toHaveBeenCalledWith('owner-token');
    expect(getMyEvents).toHaveBeenCalledWith('owner-token');
  });

  it('shows empty state when there are no announcements or events', async () => {
    getOwnerAnnouncements.mockResolvedValue([]);
    getMyEvents.mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={['/owner/announcements']}>
        <OwnerAnnouncementsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('No hay avisos publicados.')).toBeInTheDocument();
    });
  });

  it('filters by title and date, and paginates results', async () => {
    const user = userEvent.setup();
    getOwnerAnnouncements.mockResolvedValue([
      {
        id: 'ann-1',
        title: 'Asamblea ordinaria',
        description: 'Convocatoria completa.',
        created_at: '2026-07-10T10:00:00Z',
      },
      {
        id: 'ann-2',
        title: 'Mantenimiento ascensor',
        description: 'Detalle técnico.',
        created_at: '2026-07-11T10:00:00Z',
      },
      {
        id: 'ann-3',
        title: 'Corte de agua',
        description: 'Suspensión temporal.',
        created_at: '2026-07-12T10:00:00Z',
      },
      {
        id: 'ann-4',
        title: 'Parqueadero visitantes',
        description: 'Nuevo horario.',
        created_at: '2026-07-13T10:00:00Z',
      },
      {
        id: 'ann-5',
        title: 'Entrega de tarjetas',
        description: 'Retiro en administración.',
        created_at: '2026-07-14T10:00:00Z',
      },
      {
        id: 'ann-6',
        title: 'Fumigación general',
        description: 'Programación por pisos.',
        created_at: '2026-07-15T10:00:00Z',
      },
    ]);
    getMyEvents.mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={['/owner/announcements']}>
        <OwnerAnnouncementsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('6 resultados')).toBeInTheDocument();
    });

    expect(screen.getByText('Página 1 de 2')).toBeInTheDocument();
    expect(screen.getAllByText('Fumigación general')).toHaveLength(2);
    expect(screen.queryByText('Asamblea ordinaria')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Siguiente/i }));
    expect(screen.getByText('Página 2 de 2')).toBeInTheDocument();
    expect(screen.getByText('Asamblea ordinaria')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Buscar por título/i), 'agua');
    expect(screen.getByText('1 resultado')).toBeInTheDocument();
    expect(screen.getAllByText('Corte de agua')).toHaveLength(2);
    expect(screen.queryByText('Asamblea ordinaria')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Limpiar/i }));
    await user.type(screen.getByLabelText(/Desde/i), '2026-07-13');
    await user.type(screen.getByLabelText(/Hasta/i), '2026-07-14');

    expect(screen.getByText('2 resultados')).toBeInTheDocument();
    expect(screen.getAllByText('Entrega de tarjetas')).toHaveLength(2);
    expect(screen.getByText('Parqueadero visitantes')).toBeInTheDocument();
    expect(screen.queryByText('Corte de agua')).not.toBeInTheDocument();
  });
});

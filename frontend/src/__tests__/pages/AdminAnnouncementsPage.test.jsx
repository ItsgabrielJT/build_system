import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminAnnouncementsPage from '../../pages/admin/AdminAnnouncementsPage';
import {
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncements,
  updateAnnouncement,
} from '../../services/announcementService';

vi.mock('../../services/announcementService', () => ({
  getAnnouncements: vi.fn(),
  createAnnouncement: vi.fn(),
  updateAnnouncement: vi.fn(),
  deleteAnnouncement: vi.fn(),
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

describe('AdminAnnouncementsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders metrics cards, search filter, and list of announcements', async () => {
    const mockAnnouncements = [
      {
        id: 'ann-1',
        title: 'Mantenimiento de Agua',
        description: 'Habrá corte de agua de 8am a 12pm',
        created_at: '2026-07-10T12:00:00Z',
      },
    ];

    getAnnouncements.mockResolvedValue(mockAnnouncements);

    render(<AdminAnnouncementsPage />);

    await waitFor(() => {
      expect(screen.getByText('Mantenimiento de Agua')).toBeInTheDocument();
      expect(screen.getByText('Habrá corte de agua de 8am a 12pm')).toBeInTheDocument();
    });

    expect(screen.getByText('Admin / Avisos')).toBeInTheDocument();
    expect(screen.getByText('Gestión de Avisos')).toBeInTheDocument();

    expect(screen.getByText('Total avisos')).toBeInTheDocument();
    expect(screen.getAllByText('Últimos 7 días').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Este mes').length).toBeGreaterThan(0);
  });

  it('filters list based on search query', async () => {
    const mockAnnouncements = [
      {
        id: 'ann-1',
        title: 'Mantenimiento Ascensor',
        description: 'Limpieza programada',
        created_at: '2026-07-10T12:00:00Z',
      },
      {
        id: 'ann-2',
        title: 'Asamblea Anual',
        description: 'Reunión general en el lobby',
        created_at: '2026-07-11T12:00:00Z',
      },
    ];

    getAnnouncements.mockResolvedValue(mockAnnouncements);

    render(<AdminAnnouncementsPage />);

    await waitFor(() => {
      expect(screen.getByText('Mantenimiento Ascensor')).toBeInTheDocument();
      expect(screen.getByText('Asamblea Anual')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Buscar por título o descripción.../i);
    fireEvent.change(searchInput, { target: { value: 'Asamblea' } });

    expect(screen.queryByText('Mantenimiento Ascensor')).not.toBeInTheDocument();
    expect(screen.getByText('Asamblea Anual')).toBeInTheDocument();
  });

  it('opens FormModal and allows creation of a new announcement', async () => {
    getAnnouncements.mockResolvedValue([]);
    createAnnouncement.mockResolvedValue({ id: 'new-ann' });

    render(<AdminAnnouncementsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /\+ Publicar aviso/i })).toBeInTheDocument();
    });

    const createBtn = screen.getByRole('button', { name: /\+ Publicar aviso/i });
    fireEvent.click(createBtn);

    expect(screen.getByRole('heading', { name: /Publicar nuevo aviso/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Título del aviso/i), { target: { value: 'Nuevo Comunicado' } });
    fireEvent.change(screen.getByLabelText(/Descripción \/ Cuerpo del aviso/i), { target: { value: 'Descripción importante' } });

    const submitBtn = screen.getByRole('button', { name: /Guardar/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createAnnouncement).toHaveBeenCalledWith(
        {
          title: 'Nuevo Comunicado',
          description: 'Descripción importante',
        },
        'test-token'
      );
    });
  });

  it('allows editing and deleting announcements', async () => {
    const mockAnnouncements = [
      {
        id: 'ann-1',
        title: 'Mantenimiento de Agua',
        description: 'Habrá corte de agua',
        created_at: '2026-07-10T12:00:00Z',
      },
    ];

    getAnnouncements.mockResolvedValue(mockAnnouncements);
    updateAnnouncement.mockResolvedValue({ id: 'ann-1' });
    deleteAnnouncement.mockResolvedValue();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<AdminAnnouncementsPage />);

    await waitFor(() => {
      expect(screen.getByText('Mantenimiento de Agua')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Editar/i }));
    expect(screen.getByRole('heading', { name: /Editar aviso/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Título del aviso/i), { target: { value: 'Aviso actualizado' } });
    fireEvent.change(screen.getByLabelText(/Descripción \/ Cuerpo del aviso/i), { target: { value: 'Nuevo detalle' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar/i }));

    await waitFor(() => {
      expect(updateAnnouncement).toHaveBeenCalledWith(
        'ann-1',
        {
          title: 'Aviso actualizado',
          description: 'Nuevo detalle',
        },
        'test-token'
      );
    });

    fireEvent.click(screen.getByRole('button', { name: /Eliminar/i }));
    await waitFor(() => {
      expect(deleteAnnouncement).toHaveBeenCalledWith('ann-1', 'test-token');
    });
  });
});

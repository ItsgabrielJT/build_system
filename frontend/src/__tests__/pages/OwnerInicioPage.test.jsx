import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OwnerInicioPage from '../../pages/owner/OwnerInicioPage';
import { getRecentAnnouncements } from '../../services/announcementService';
import { getMyEvents } from '../../services/eventService';
import { getOwnerProfile } from '../../services/ownerService';

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

vi.mock('../../services/ownerService', () => ({
  getOwnerProfile: vi.fn(),
}));

vi.mock('../../services/announcementService', () => ({
  getRecentAnnouncements: vi.fn(),
}));

vi.mock('../../services/eventService', () => ({
  getMyEvents: vi.fn(),
}));

describe('OwnerInicioPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders recent announcements from the owner API', async () => {
    getOwnerProfile.mockResolvedValue({
      full_name: 'Propietario Demo',
      phone: '0999999999',
      apartments: [{ code: 'A-101', tower: 'Norte' }],
      balance_consolidated: 0,
      recent_transactions: [],
    });
    getRecentAnnouncements.mockResolvedValue([
      {
        id: 'ann-1',
        title: 'Mantenimiento de ascensor',
        description: 'El ascensor estará fuera de servicio de 09:00 a 11:00.',
      },
      {
        id: 'ann-2',
        title: 'Pago oportuno',
        description: 'Recuerde realizar su pago antes del día 10.',
      },
    ]);
    getMyEvents.mockResolvedValue([]);

    render(<OwnerInicioPage />);

    await waitFor(() => {
      expect(screen.queryByText('Cargando panel de inicio...')).not.toBeInTheDocument();
      expect(screen.getByText('Mantenimiento de ascensor')).toBeInTheDocument();
    });

    expect(screen.getByText('El ascensor estará fuera de servicio de 09:00 a 11:00.')).toBeInTheDocument();
    expect(screen.getByText('Pago oportuno')).toBeInTheDocument();
    expect(screen.getByText('Publicados recientemente')).toBeInTheDocument();
    expect(getRecentAnnouncements).toHaveBeenCalledWith('owner-token', 5);
  });

  it('shows an empty state when there are no announcements', async () => {
    getOwnerProfile.mockResolvedValue({
      full_name: 'Propietario Demo',
      apartments: [],
      balance_consolidated: 0,
      recent_transactions: [],
    });
    getRecentAnnouncements.mockResolvedValue([]);
    getMyEvents.mockResolvedValue([]);

    render(<OwnerInicioPage />);

    await waitFor(() => {
      expect(screen.getByText('No hay avisos publicados.')).toBeInTheDocument();
    });
  });
});

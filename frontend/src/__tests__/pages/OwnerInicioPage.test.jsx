import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OwnerInicioPage from '../../pages/owner/OwnerInicioPage';
import { getRecentAnnouncements } from '../../services/announcementService';
import { getMyEvents } from '../../services/eventService';
import { getOwnerProfile } from '../../services/ownerService';
import { getOwnerPayments } from '../../services/paymentService';

const toastError = vi.hoisted(() => vi.fn());

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    token: 'owner-token',
    role: 'PROPIETARIO',
  }),
}));

vi.mock('../../context/NotificationContext', () => ({
  useNotification: () => ({
    success: vi.fn(),
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

vi.mock('../../services/paymentService', () => ({
  getOwnerPayments: vi.fn(),
}));

vi.mock('../../services/buildingService', () => ({
  getBuildingConfig: vi.fn().mockResolvedValue({ id: 'building-1' }),
  getBuildingAssetBlob: vi.fn(),
}));

describe('OwnerInicioPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOwnerPayments.mockResolvedValue([]);
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

  it('renders pending debt from the owner profile balance', async () => {
    getOwnerProfile.mockResolvedValue({
      full_name: 'Propietario Demo',
      apartments: [],
      balance_consolidated: 125.5,
      recent_transactions: [],
    });
    getRecentAnnouncements.mockResolvedValue([]);
    getMyEvents.mockResolvedValue([]);

    render(<OwnerInicioPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Con deuda').length).toBeGreaterThan(0);
    });

    expect(screen.getByText('USD 125,50')).toBeInTheDocument();
    expect(screen.getByText('USD 125,50 pendiente')).toBeInTheDocument();
    expect(screen.getByText('Valor pendiente de pago')).toBeInTheDocument();
  });

  it('shows the latest registered payment by payment date even when API order is older first', async () => {
    getOwnerProfile.mockResolvedValue({
      full_name: 'Propietario Demo',
      apartments: [],
      balance_consolidated: 0,
      recent_transactions: [],
    });
    getRecentAnnouncements.mockResolvedValue([]);
    getMyEvents.mockResolvedValue([]);
    getOwnerPayments.mockResolvedValue([
      {
        id: 'pay-old',
        amount: 16.82,
        status: 'REGISTRADO',
        paid_at: '2026-06-01',
        created_at: '2026-07-20T10:00:00',
      },
      {
        id: 'pay-latest',
        amount: 40,
        status: 'REGISTRADO',
        paid_at: '2026-07-01',
        created_at: '2026-07-01T10:00:00',
      },
    ]);

    render(<OwnerInicioPage />);

    await waitFor(() => {
      expect(screen.queryByText('Cargando panel de inicio...')).not.toBeInTheDocument();
    });

    expect(screen.getByText('USD 40,00')).toBeInTheDocument();
    expect(screen.getByText('01/07/2026')).toBeInTheDocument();
  });

  it('redirects to the documents link if configured', async () => {
    const documentsLink = 'https://example.com/docs';
    const { getBuildingConfig } = await import('../../services/buildingService');
    getBuildingConfig.mockResolvedValue({
      id: 'building-1',
      documents_link: documentsLink,
    });

    getOwnerProfile.mockResolvedValue({
      full_name: 'Propietario Demo',
      apartments: [],
      balance_consolidated: 0,
      recent_transactions: [],
    });
    getRecentAnnouncements.mockResolvedValue([]);
    getMyEvents.mockResolvedValue([]);

    const openMock = vi.spyOn(window, 'open').mockImplementation(() => {});

    render(<OwnerInicioPage />);

    await waitFor(() => {
      expect(screen.queryByText('Cargando panel de inicio...')).not.toBeInTheDocument();
    });

    const btn = screen.getByText('Ver documentos');
    btn.click();

    expect(openMock).toHaveBeenCalledWith(documentsLink, '_blank', 'noopener,noreferrer');
    openMock.mockRestore();
  });

  it('does not allow downloading the expense certificate when owner has pending debt', async () => {
    getOwnerProfile.mockResolvedValue({
      full_name: 'Propietario Demo',
      apartments: [],
      balance_consolidated: 125.5,
      recent_transactions: [],
    });
    getRecentAnnouncements.mockResolvedValue([]);
    getMyEvents.mockResolvedValue([]);

    render(<OwnerInicioPage />);

    await waitFor(() => {
      expect(screen.queryByText('Cargando panel de inicio...')).not.toBeInTheDocument();
    });

    const btn = screen.getByText('Descargar certificado');
    btn.click();

    expect(toastError).toHaveBeenCalledWith('No puede descargar el certificado de expensas hasta estar al día con sus pagos.');
  });
});

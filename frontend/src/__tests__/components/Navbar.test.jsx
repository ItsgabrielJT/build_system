import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Navbar from '../../components/Navbar/Navbar';
import { useAuth } from '../../hooks/useAuth';
import { useAdminNotifications } from '../../hooks/useAdminNotifications';

vi.mock('../../hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('../../hooks/useAdminNotifications', () => ({ useAdminNotifications: vi.fn() }));

describe('Navbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra el panel de notificaciones del administrador', async () => {
    const user = userEvent.setup();
    const fetchNotifications = vi.fn();

    useAuth.mockReturnValue({
      user: { email: 'admin@test.com' },
      role: 'ADMIN',
    });

    useAdminNotifications.mockReturnValue({
      notifications: [
        {
          id: 'notif-1',
          title: 'Pago pendiente de revisión — 2026-05',
          body: 'El propietario Carlos Torres envió un comprobante.',
          created_at: '2026-05-31T10:00:00Z',
        },
      ],
      total: 1,
      loading: false,
      error: null,
      fetchNotifications,
      enabled: true,
    });

    render(
      <MemoryRouter initialEntries={['/admin/payments']}>
        <Navbar onToggleSidebar={vi.fn()} />
      </MemoryRouter>
    );

    expect(screen.getByText('1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Notificaciones/i }));

    expect(fetchNotifications).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Pago pendiente de revisión/i)).toBeInTheDocument();
    expect(screen.getByText(/Carlos Torres/i)).toBeInTheDocument();
  });

  it('no abre panel ni consulta notificaciones para propietario', async () => {
    const user = userEvent.setup();
    const fetchNotifications = vi.fn();

    useAuth.mockReturnValue({
      user: { email: 'owner@test.com' },
      role: 'PROPIETARIO',
    });

    useAdminNotifications.mockReturnValue({
      notifications: [],
      total: 0,
      loading: false,
      error: null,
      fetchNotifications,
      enabled: false,
    });

    render(
      <MemoryRouter initialEntries={['/owner/payments']}>
        <Navbar onToggleSidebar={vi.fn()} />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: /Notificaciones/i }));

    expect(fetchNotifications).not.toHaveBeenCalled();
    expect(screen.queryByText(/No hay notificaciones pendientes/i)).not.toBeInTheDocument();
  });
});
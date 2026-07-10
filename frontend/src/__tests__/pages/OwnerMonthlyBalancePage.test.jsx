import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OwnerMonthlyBalancePage from '../../pages/owner/OwnerMonthlyBalancePage';
import { useMonthlyBalance } from '../../hooks/useMonthlyBalance';

vi.mock('../../hooks/useMonthlyBalance', () => ({
  useMonthlyBalance: vi.fn(),
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ token: 'mock-token' }),
}));

vi.mock('../../context/NotificationContext', () => ({
  useNotification: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }),
}));

describe('OwnerMonthlyBalancePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMonthlyBalance.mockReturnValue({
      data: {
        period: '2026-05',
        income_total: 2100,
        expense_total: 1400,
        net_balance: 700,
        income_breakdown: [{ label: 'Cuotas', amount: 2100 }],
        expense_breakdown: [{ label: 'Mantenimiento', amount: 1000 }],
        previous_period_variation: {
          income_pct: 1.5,
          expense_pct: -2,
          net_balance_pct: 5,
        },
      },
      loading: false,
      error: null,
      reload: vi.fn(),
    });
  });

  it('renders readonly monthly balance', () => {
    render(<OwnerMonthlyBalancePage />);

    expect(screen.getByRole('heading', { name: /Balance mensual del edificio/i })).toBeInTheDocument();
    expect(screen.getByText(/Solo lectura/i)).toBeInTheDocument();
    expect(screen.getByText('Ingresos del mes')).toBeInTheDocument();
    expect(screen.getByText('Comparativo del mes')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Exportar/i })).not.toBeInTheDocument();
  });
});
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminReportsPage from '../../pages/admin/AdminReportsPage';
import { useMonthlyBalance } from '../../hooks/useMonthlyBalance';
import * as reportService from '../../services/reportService';

vi.mock('../../services/reportService');
vi.mock('../../hooks/useMonthlyBalance', () => ({
  useMonthlyBalance: vi.fn(),
}));
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    token: 'test-token',
    user: { id: 'user1' },
    role: 'ADMIN',
  }),
}));

const statsFixture = {
  summary: {
    total_revenue: 124500,
    total_expenses: 98200,
    net_income: 26300,
    revenue_change_percent: 4.2,
    expense_change_percent: -1.5,
    net_income_change_percent: 9,
  },
  expense_categories: [
    { category: 'Maintenance', amount: 45000 },
    { category: 'Utilities', amount: 28000 },
  ],
  monthly: [
    { period: '2026-04', expected: 15000, collected: 14200 },
    { period: '2026-05', expected: 16000, collected: 16700 },
  ],
  arrears: [
    {
      unit: '10A',
      owner: 'Carlos Mendoza',
      email: 'carlos@example.com',
      amount_due: 1250,
      days_overdue: '90+ Days',
      risk_level: 'High',
    },
  ],
  risk_summary: { high: 1, medium: 0, low: 0 },
  system: { active_owners: 1, active_apartments: 1, delinquent_units: 1 },
};

describe('AdminReportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMonthlyBalance.mockReturnValue({
      data: {
        period: '2026-05',
        income_total: 2500,
        expense_total: 1750,
        net_balance: 750,
        income_breakdown: [{ label: 'Cuotas', amount: 2300 }],
        expense_breakdown: [{ label: 'Mantenimiento', amount: 900 }],
        previous_period_variation: {
          income_pct: 4.2,
          expense_pct: -1.5,
          net_balance_pct: 12.1,
        },
      },
      loading: false,
      error: null,
      reload: vi.fn(),
    });
    reportService.getDashboardStats.mockResolvedValue(statsFixture);
    reportService.downloadDelinquencyReport.mockResolvedValue(new Blob(['delinquency']));
    reportService.downloadIncomeReport.mockResolvedValue(new Blob(['income']));
    reportService.downloadBalanceReport.mockResolvedValue(new Blob(['balance']));
    reportService.downloadPaymentsReport.mockResolvedValue(new Blob(['payments']));
    reportService.downloadExpensesReport.mockResolvedValue(new Blob(['expenses']));
    global.URL.createObjectURL = vi.fn(() => 'blob:test');
    global.URL.revokeObjectURL = vi.fn();
  });

  it('renderiza el dashboard financiero con estadísticas reales del servicio', async () => {
    render(<AdminReportsPage />);

    expect(screen.getByRole('heading', { name: /Reportes financieros/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Descargar PDF/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Descargar Excel/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Reporte')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('$124.500')).toBeInTheDocument();
      expect(screen.getByText('$98.200')).toBeInTheDocument();
      expect(screen.getByText('$26.300')).toBeInTheDocument();
    });

    expect(screen.getByText('Balance mensual del edificio')).toBeInTheDocument();
    expect(screen.getByText('Ingresos del mes')).toBeInTheDocument();
    expect(screen.getByText('Comparativo del mes')).toBeInTheDocument();
    expect(screen.getByText('Categorías de gastos')).toBeInTheDocument();
    expect(screen.getByText('Emitido vs cobrado')).toBeInTheDocument();
    expect(screen.getByText('Mora y saldos pendientes')).toBeInTheDocument();
    expect(screen.getByText('Carlos Mendoza')).toBeInTheDocument();
  });

  it('consulta estadísticas con rango de fechas', async () => {
    render(<AdminReportsPage />);

    await waitFor(() => {
      expect(reportService.getDashboardStats).toHaveBeenCalledWith(
        'test-token',
        expect.objectContaining({
          start_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          end_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        })
      );
    });
  });

  it('exporta solo el reporte seleccionado en PDF', async () => {
    const user = userEvent.setup();
    render(<AdminReportsPage />);

    await user.selectOptions(screen.getByLabelText('Reporte'), 'balance');
    await user.click(screen.getByRole('button', { name: /Descargar PDF/i }));

    await waitFor(() => {
      expect(reportService.downloadBalanceReport).toHaveBeenCalledWith(
        'test-token',
        expect.objectContaining({ format: 'pdf' })
      );
      expect(reportService.downloadIncomeReport).not.toHaveBeenCalled();
      expect(reportService.downloadDelinquencyReport).not.toHaveBeenCalled();
    });
  });

  it('actualiza estadísticas al cambiar fecha de inicio', async () => {
    const user = userEvent.setup();
    render(<AdminReportsPage />);

    await user.clear(screen.getByLabelText('Inicio'));
    await user.type(screen.getByLabelText('Inicio'), '2026-03-01');

    await waitFor(() => {
      expect(reportService.getDashboardStats).toHaveBeenLastCalledWith(
        'test-token',
        expect.objectContaining({ start_date: '2026-03-01' })
      );
    });
  });

  it('muestra mensaje de error si falla la descarga', async () => {
    const user = userEvent.setup();
    reportService.downloadDelinquencyReport.mockRejectedValue(new Error('Network error'));

    render(<AdminReportsPage />);

    await user.selectOptions(screen.getByLabelText('Reporte'), 'delinquency');
    await user.click(screen.getByRole('button', { name: /Descargar PDF/i }));

    await waitFor(() => {
      expect(screen.getByText(/Network error/i)).toBeInTheDocument();
    });
  });
});

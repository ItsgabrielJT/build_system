import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OwnerMonthlyBalancePage from '../../pages/owner/OwnerMonthlyBalancePage';
import { useMonthlyBalance } from '../../hooks/useMonthlyBalance';
import { downloadExpensesReport, downloadPaymentsReport } from '../../services/reportService';

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

vi.mock('../../services/reportService', () => ({
  downloadExpensesReport: vi.fn(),
  downloadIncomeReport: vi.fn(),
  downloadOwnerMonthlyBalancePdf: vi.fn(),
  downloadPaymentsReport: vi.fn(),
}));

describe('OwnerMonthlyBalancePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
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

  it('downloads the payments report when the payments option is selected', async () => {
    const user = userEvent.setup();
    downloadPaymentsReport.mockResolvedValue(new Blob(['payments']));

    render(<OwnerMonthlyBalancePage />);

    await user.selectOptions(screen.getByLabelText('Reporte'), 'payments');
    await user.click(screen.getByRole('button', { name: /Descargar PDF/i }));

    expect(downloadPaymentsReport).toHaveBeenCalledWith('mock-token', {
      start_date: expect.stringMatching(/^\d{4}-\d{2}-01$/),
      end_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      format: 'pdf',
    });
    expect(downloadExpensesReport).not.toHaveBeenCalled();
  });
});

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminExpensesPage from '../../pages/admin/AdminExpensesPage';
import * as expenseService from '../../services/expenseService';

vi.mock('../../services/expenseService', () => ({
  createExpense: vi.fn(),
  getMonthlyStats: vi.fn(),
  getChartData: vi.fn(),
  getRecentExpenses: vi.fn(),
  getExpensesByMonth: vi.fn(),
  updateExpense: vi.fn(),
  deleteExpense: vi.fn(),
  downloadExpenseReceipt: vi.fn(),
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    token: 'test-token',
    user: { id: 'admin1' },
    role: 'ADMIN',
  }),
}));

vi.mock('../../context/NotificationContext', () => ({
  useNotification: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock chart components since Recharts uses SVG elements that don't layout well in JSDOM
vi.mock('../../components/ExpenseCategoryChart/ExpenseCategoryChart', () => ({
  default: () => <div data-testid="category-chart">Category Chart</div>,
}));
vi.mock('../../components/ExpenseTrendChart/ExpenseTrendChart', () => ({
  default: () => <div data-testid="trend-chart">Trend Chart</div>,
}));

describe('AdminExpensesPage', () => {
  const mockRecent = [
    {
      id: 'e1',
      date: '2026-06-04',
      concept: 'Reparación de ascensor',
      provider: 'Elevatech',
      amount: 1500,
      category: 'Mantenimiento',
      receipt_file_name: 'recibo.pdf',
    },
    {
      id: 'e2',
      date: '2026-06-02',
      concept: 'Limpieza de áreas comunes',
      provider: 'CleanInc',
      amount: 500,
      category: 'Limpieza',
      receipt_file_name: null,
    },
  ];

  const mockStats = {
    total_spend: 2000,
    budget: 15000,
    percentage_used: 13.33,
    maintenance_spend: 1500,
    maintenance_budget: 3500,
    maintenance_percentage: 42.86,
    categories: [],
  };

  const mockChart = {
    by_category: [],
    monthly_trend: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    expenseService.getRecentExpenses.mockResolvedValue(mockRecent);
    expenseService.getMonthlyStats.mockResolvedValue(mockStats);
    expenseService.getChartData.mockResolvedValue(mockChart);
    expenseService.getExpensesByMonth.mockResolvedValue({ data: mockRecent, total: 2000 });
  });

  it('renderiza la página con estadísticas y lista de gastos recientes', async () => {
    render(<AdminExpensesPage />);

    expect(screen.getByText('Registro de Gastos')).toBeInTheDocument();
    expect(screen.getByText('Registrar Nuevo Gasto')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Reparación de ascensor')).toBeInTheDocument();
      expect(screen.getByText('Limpieza de áreas comunes')).toBeInTheDocument();
      expect(screen.getByTestId('category-chart')).toBeInTheDocument();
      expect(screen.getByTestId('trend-chart')).toBeInTheDocument();
    });
  });

  it('abre el modal "Ver Todo" y permite filtrar gastos', async () => {
    const user = userEvent.setup();
    render(<AdminExpensesPage />);

    // Click "Ver Todo"
    const viewAllButton = await screen.findByText('Ver Todo');
    await user.click(viewAllButton);

    // Verify modal is open
    expect(screen.getByText('Listado Completo de Gastos')).toBeInTheDocument();
    const viewAllModal = screen.getByTestId('view-all-modal');

    // Verify both items are in the table inside the modal
    expect(within(viewAllModal).getByText('Reparación de ascensor')).toBeInTheDocument();
    expect(within(viewAllModal).getByText('Limpieza de áreas comunes')).toBeInTheDocument();

    // Type in provider search filter
    const searchInput = within(viewAllModal).getByPlaceholderText('ej. Acme, Agua...');
    await user.type(searchInput, 'Elevatech');

    // Reparación de ascensor (provider Elevatech) should remain, Limpieza de áreas comunes (provider CleanInc) should be filtered out
    expect(within(viewAllModal).queryByText('Limpieza de áreas comunes')).not.toBeInTheDocument();
    expect(within(viewAllModal).getByText('Reparación de ascensor')).toBeInTheDocument();
  });

  it('abre el modal "Editar" y envía los cambios', async () => {
    const user = userEvent.setup();
    expenseService.updateExpense.mockResolvedValue({ id: 'e1', concept: 'Reparación de ascensor actualizada' });

    render(<AdminExpensesPage />);

    // Open Ver Todo modal
    const viewAllButton = await screen.findByText('Ver Todo');
    await user.click(viewAllButton);

    const viewAllModal = screen.getByTestId('view-all-modal');

    // Click on Edit button for e1
    const editButtons = within(viewAllModal).getAllByRole('button', { name: /Editar/i });
    await user.click(editButtons[0]);

    // Verify edit modal is open
    expect(screen.getByText('Editar Gasto')).toBeInTheDocument();
    const editModal = screen.getByTestId('edit-modal');

    // Change concept
    const conceptTextarea = within(editModal).getByPlaceholderText('Breve descripción del gasto...');
    await user.clear(conceptTextarea);
    await user.type(conceptTextarea, 'Reparación de ascensor actualizada');

    // Click Save
    const saveButton = within(editModal).getByRole('button', { name: /Guardar Cambios/i });
    await user.click(saveButton);

    // Verify update API was called
    await waitFor(() => {
      expect(expenseService.updateExpense).toHaveBeenCalled();
    });
  });

  it('solicita confirmación y elimina un gasto', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    expenseService.deleteExpense.mockResolvedValue({ success: true });

    render(<AdminExpensesPage />);

    // Open Ver Todo modal
    const viewAllButton = await screen.findByText('Ver Todo');
    await user.click(viewAllButton);

    const viewAllModal = screen.getByTestId('view-all-modal');

    // Click on Delete button for e1
    const deleteButtons = within(viewAllModal).getAllByRole('button', { name: /Eliminar/i });
    await user.click(deleteButtons[0]);

    // Verify confirm and delete API call
    expect(window.confirm).toHaveBeenCalledWith('¿Está seguro de que desea eliminar este gasto?');
    await waitFor(() => {
      expect(expenseService.deleteExpense).toHaveBeenCalledWith('e1', 'test-token');
    });
  });
});

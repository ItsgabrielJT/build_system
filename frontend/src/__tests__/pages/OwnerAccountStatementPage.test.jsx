import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OwnerAccountStatementPage from '../../pages/owner/OwnerAccountStatementPage';
import { useAccountStatement } from '../../hooks/useAccountStatement';

vi.mock('../../hooks/useAccountStatement', () => ({ useAccountStatement: vi.fn() }));

describe('OwnerAccountStatementPage', () => {
  it('dispara exportacion a PDF desde la UI', async () => {
    const user = userEvent.setup();
    const fetchStatement = vi.fn();
    const exportStatement = vi.fn();

    useAccountStatement.mockReturnValue({
      statement: [
        {
          period: '2026-05',
          apartment_code: '101',
          esperado: 5000,
          multas: 0,
          pagado: 2000,
          saldo: 3000,
          status: 'OVERDUE',
        },
      ],
      loading: false,
      exporting: false,
      error: null,
      fetchStatement,
      exportStatement,
    });

    render(<OwnerAccountStatementPage />);

    await waitFor(() => {
      expect(fetchStatement).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole('button', { name: /Descargar PDF/i }));

    expect(exportStatement).toHaveBeenCalledWith(
      'pdf',
      expect.objectContaining({
        start_period: expect.any(String),
        end_period: expect.any(String),
      }),
      expect.stringContaining('.pdf')
    );
  });
});

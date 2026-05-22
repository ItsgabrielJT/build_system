import { render, screen, waitFor } from '@testing-library/react';
import AdminDelinquencyPage from '../../pages/admin/AdminDelinquencyPage';
import { useDelinquency } from '../../hooks/useDelinquency';

vi.mock('../../hooks/useDelinquency', () => ({ useDelinquency: vi.fn() }));

describe('AdminDelinquencyPage', () => {
  it('muestra el rediseño de morosidad con unidades y totales', async () => {
    const fetchDelinquentOwners = vi.fn();
    const fetchDelinquencyStats = vi.fn();

    useDelinquency.mockReturnValue({
      delinquentOwners: [
        {
          id: 'owner-1',
          owner_name: 'Carlos Ruiz',
          email: 'carlos@mail.com',
          deuda_total: 1200,
          periodos_vencidos: 2,
          status: 'OVERDUE',
        },
      ],
      ownerDetail: null,
      loading: false,
      error: null,
      fetchDelinquentOwners,
      fetchDelinquencyStats,
      fetchOwnerDetail: vi.fn(),
    });

    render(<AdminDelinquencyPage />);

    await waitFor(() => {
      expect(fetchDelinquentOwners).toHaveBeenCalledWith({ status: 'OVERDUE' });
    });

    expect(screen.getByText('Carlos Ruiz')).toBeInTheDocument();
    expect(screen.getByText('Detalle de Unidades Morosas')).toBeInTheDocument();
    expect(screen.getAllByText('$1,200').length).toBeGreaterThan(0);
  });
});

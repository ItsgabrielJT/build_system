import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminPaymentsPage from '../../pages/admin/AdminPaymentsPage';
import { usePayments } from '../../hooks/usePayments';
import { useApartments } from '../../hooks/useApartments';
import { useOwners } from '../../hooks/useOwners';

vi.mock('../../hooks/usePayments', () => ({ usePayments: vi.fn() }));
vi.mock('../../hooks/useApartments', () => ({ useApartments: vi.fn() }));
vi.mock('../../hooks/useOwners', () => ({ useOwners: vi.fn() }));

describe('AdminPaymentsPage', () => {
  it('filtra pagos por periodo', async () => {
    const fetchPayments = vi.fn();
    const fetchApartments = vi.fn();
    const fetchOwners = vi.fn();

    usePayments.mockReturnValue({
      payments: [],
      loading: false,
      error: null,
      fetchPayments,
      createPayment: vi.fn(),
      annulPayment: vi.fn(),
    });

    useApartments.mockReturnValue({
      apartments: [],
      fetchApartments,
    });

    useOwners.mockReturnValue({
      owners: [],
      fetchOwners,
    });

    const { container } = render(<AdminPaymentsPage />);

    await waitFor(() => {
      expect(fetchApartments).toHaveBeenCalledTimes(1);
      expect(fetchOwners).toHaveBeenCalledTimes(1);
      expect(fetchPayments).toHaveBeenCalledWith({});
    });

    const periodInput = container.querySelector('input[type="month"]');
    expect(periodInput).not.toBeNull();
    fireEvent.change(periodInput, { target: { value: '2026-05' } });

    await waitFor(() => {
      expect(fetchPayments).toHaveBeenCalledWith({ period: '2026-05' });
    });
  });
});

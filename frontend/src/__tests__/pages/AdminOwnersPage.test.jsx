import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminOwnersPage from '../../pages/admin/AdminOwnersPage';
import { useOwners } from '../../hooks/useOwners';

vi.mock('../../hooks/useOwners', () => ({ useOwners: vi.fn() }));

describe('AdminOwnersPage', () => {
  it('envia formulario y crea propietario', async () => {
    const user = userEvent.setup();
    const fetchOwners = vi.fn();
    const createOwner = vi.fn().mockResolvedValue({ id: 'new-owner' });

    useOwners.mockReturnValue({
      owners: [],
      loading: false,
      error: null,
      fetchOwners,
      createOwner,
      updateOwner: vi.fn(),
      deleteOwner: vi.fn(),
    });

    render(<AdminOwnersPage />);

    await user.click(screen.getByRole('button', { name: /Nuevo propietario/i }));

    const textInputs = screen.getAllByRole('textbox');
    await user.type(textInputs[0], 'Juan Perez');
    await user.type(textInputs[1], '12345');
    await user.type(textInputs[2], 'juan@mail.com');
    await user.type(textInputs[3], '3001234567');

    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(createOwner).toHaveBeenCalledWith({
        full_name: 'Juan Perez',
        document_id: '12345',
        email: 'juan@mail.com',
        phone: '3001234567',
      });
    });

    expect(fetchOwners).toHaveBeenCalledTimes(1);
  });
});

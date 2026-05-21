import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import BuildingInfoModal from '../../components/BuildingInfoModal/BuildingInfoModal';

describe('BuildingInfoModal', () => {
  it('no renderiza cuando isOpen es false', () => {
    const { container } = render(
      <BuildingInfoModal isOpen={false} onClose={vi.fn()} onSave={vi.fn()} building={null} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renderiza el modal cuando isOpen es true', () => {
    render(
      <BuildingInfoModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={vi.fn()}
        building={{ id: 'b1', name: 'Edificio A', address: 'Calle 1', phone: '123', email: 'test@test.com' }}
      />
    );
    expect(screen.getByText('Editar Información del Edificio')).toBeInTheDocument();
  });

  it('pre-carga los datos del edificio en los campos', () => {
    render(
      <BuildingInfoModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={vi.fn()}
        building={{ id: 'b1', name: 'Edificio A', address: 'Calle 1', phone: '123', email: 'test@test.com' }}
      />
    );

    expect(screen.getByDisplayValue('Edificio A')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Calle 1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('123')).toBeInTheDocument();
    expect(screen.getByDisplayValue('test@test.com')).toBeInTheDocument();
  });

  it('llama a onClose al hacer click en el botón cerrar', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <BuildingInfoModal
        isOpen={true}
        onClose={onClose}
        onSave={vi.fn()}
        building={{ id: 'b1', name: 'Edificio A', address: '', phone: '', email: '' }}
      />
    );

    const closeButton = screen.getByRole('button', { name: 'Cerrar' });
    await user.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('llama a onClose al hacer click en cancelar', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <BuildingInfoModal
        isOpen={true}
        onClose={onClose}
        onSave={vi.fn()}
        building={{ id: 'b1', name: 'Edificio A', address: '', phone: '', email: '' }}
      />
    );

    const cancelButton = screen.getByRole('button', { name: 'Cancelar' });
    await user.click(cancelButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('valida que el nombre sea obligatorio', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <BuildingInfoModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={onSave}
        building={{ id: 'b1', name: '', address: '', phone: '', email: '' }}
      />
    );

    // El campo name tiene required, así que el form no debería enviar
    const submitButton = screen.getByRole('button', { name: /Guardar cambios/i });
    const nameInput = screen.getByLabelText(/Nombre del Edificio/i);

    // Intentar enviar sin llenar el campo requerido
    expect(nameInput).toBeRequired();
  });

  it('llama a onSave con los datos modificados al guardar', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue({});
    const onClose = vi.fn();

    render(
      <BuildingInfoModal
        isOpen={true}
        onClose={onClose}
        onSave={onSave}
        building={{ id: 'b1', name: 'Edificio Viejo', address: '', phone: '', email: '' }}
      />
    );

    const nameInput = screen.getByDisplayValue('Edificio Viejo');
    const addressInput = screen.getByPlaceholderText('ej. Calle Principal 123');
    const submitButton = screen.getByRole('button', { name: /Guardar cambios/i });

    await user.clear(nameInput);
    await user.type(nameInput, 'Edificio Nuevo');
    await user.type(addressInput, 'Nueva Avenida 456');

    await user.click(submitButton);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Edificio Nuevo',
          address: 'Nueva Avenida 456',
        })
      );
    });
  });

  it('muestra el botón de guardar como deshabilitado mientras se guarda', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)));

    render(
      <BuildingInfoModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={onSave}
        building={{ id: 'b1', name: 'Edificio A', address: '', phone: '', email: '' }}
      />
    );

    const nameInput = screen.getByDisplayValue('Edificio A');
    const submitButton = screen.getByRole('button', { name: /Guardar cambios/i });

    await user.type(nameInput, 'X');
    await user.click(submitButton);

    await waitFor(() => {
      expect(submitButton).toBeDisabled();
    });
  });

  it('cierra el modal después de guardar exitosamente', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue({});
    const onClose = vi.fn();

    render(
      <BuildingInfoModal
        isOpen={true}
        onClose={onClose}
        onSave={onSave}
        building={{ id: 'b1', name: 'Edificio A', address: '', phone: '', email: '' }}
      />
    );

    const nameInput = screen.getByDisplayValue('Edificio A');
    const submitButton = screen.getByRole('button', { name: /Guardar cambios/i });

    await user.type(nameInput, 'X');
    await user.click(submitButton);

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });
});

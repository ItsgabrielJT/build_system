import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Table from '../../components/Table/Table';

describe('Table component', () => {
  it('muestra estado de carga y estado vacio', () => {
    const { rerender } = render(
      <Table data={[]} columns={[]} loading emptyText="Sin datos" />
    );

    expect(screen.getByText('Cargando...')).toBeInTheDocument();

    rerender(<Table data={[]} columns={[]} loading={false} emptyText="Sin datos" />);
    expect(screen.getByText('Sin datos')).toBeInTheDocument();
  });

  it('renderiza filas y ejecuta acciones editar/eliminar', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    const data = [
      { id: 'o1', full_name: 'Juan Perez', amount: 1500 },
    ];
    const columns = [
      { key: 'full_name', label: 'Nombre' },
      { key: 'amount', label: 'Monto', render: (value) => `$${value}` },
    ];

    render(
      <Table
        data={data}
        columns={columns}
        loading={false}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );

    expect(screen.getByText('Juan Perez')).toBeInTheDocument();
    expect(screen.getByText('$1500')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Editar' }));
    await user.click(screen.getByRole('button', { name: 'Eliminar' }));

    expect(onEdit).toHaveBeenCalledWith(data[0]);
    expect(onDelete).toHaveBeenCalledWith(data[0]);
  });
});

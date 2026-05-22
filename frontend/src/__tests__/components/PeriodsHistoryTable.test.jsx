import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PeriodsHistoryTable from '../../components/PeriodsHistoryTable/PeriodsHistoryTable';
import styles from '../../components/PeriodsHistoryTable/PeriodsHistoryTable.module.css';

describe('PeriodsHistoryTable', () => {
  it('renders loading state', () => {
    render(<PeriodsHistoryTable loading={true} />);

    expect(screen.getByText('Cargando períodos...')).toBeInTheDocument();
  });

  it('renders period rows correctly', () => {
    const data = [
      {
        period: '2026-05',
        status: 'ABIERTO',
        total_emitido: 1240500,
        total_recaudado: 892300,
        delinquency_rate: 28.0,
      },
    ];

    render(
      <PeriodsHistoryTable
        loading={false}
        data={data}
        total={1}
        page={1}
        pageSize={10}
      />
    );

    expect(screen.getByText('Mayo 2026')).toBeInTheDocument();
    expect(screen.getByText('ABIERTO')).toBeInTheDocument();
    expect(screen.getByText(/\$1[\.,]240[\.,]500/)).toBeInTheDocument();
    expect(screen.getByText(/\$892[\.,]300/)).toBeInTheDocument();
  });

  it('renders ABIERTO badge in blue', () => {
    render(
      <PeriodsHistoryTable
        loading={false}
        data={[{ period: '2026-05', status: 'ABIERTO' }]}
        total={1}
      />
    );

    expect(screen.getByText('ABIERTO')).toHaveClass(styles.badge_ABIERTO);
  });

  it('renders VENCIDO badge in orange', () => {
    render(
      <PeriodsHistoryTable
        loading={false}
        data={[{ period: '2026-04', status: 'VENCIDO' }]}
        total={1}
      />
    );

    expect(screen.getByText('VENCIDO')).toHaveClass(styles.badge_VENCIDO);
  });

  it('renders CERRADO badge in grey', () => {
    render(
      <PeriodsHistoryTable
        loading={false}
        data={[{ period: '2026-03', status: 'CERRADO' }]}
        total={1}
      />
    );

    expect(screen.getByText('CERRADO')).toHaveClass(styles.badge_CERRADO);
  });

  it('calls onPageChange when page button clicked', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();

    render(
      <PeriodsHistoryTable
        loading={false}
        data={[{ period: '2026-05', status: 'ABIERTO' }]}
        total={25}
        page={1}
        pageSize={10}
        onPageChange={onPageChange}
      />
    );

    await user.click(screen.getByRole('button', { name: '2' }));

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('calls onFilterYear when year filter selected', async () => {
    const user = userEvent.setup();
    const onFilterYear = vi.fn();

    render(
      <PeriodsHistoryTable
        loading={false}
        data={[]}
        total={0}
        onFilterYear={onFilterYear}
      />
    );

    await user.click(screen.getByRole('button', { name: /Filtrar Año/i }));

    expect(onFilterYear).toHaveBeenCalledWith(new Date().getFullYear());
  });

  it('calls onExport when export button clicked', async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();

    render(
      <PeriodsHistoryTable
        loading={false}
        data={[]}
        total={0}
        onExport={onExport}
      />
    );

    await user.click(screen.getByRole('button', { name: /Exportar Todo/i }));

    expect(onExport).toHaveBeenCalled();
  });
});
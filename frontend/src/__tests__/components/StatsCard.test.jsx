import { render, screen } from '@testing-library/react';
import StatsCard from '../../components/StatsCard/StatsCard';
import styles from '../../components/StatsCard/StatsCard.module.css';

describe('StatsCard', () => {
  it('renders title and value', () => {
    render(
      <StatsCard
        title="Total Emitido"
        value="$1.240.500"
      />
    );

    expect(screen.getByText('Total Emitido')).toBeInTheDocument();
    expect(screen.getByText('$1.240.500')).toBeInTheDocument();
  });

  it('renders badge when provided', () => {
    render(
      <StatsCard
        title="Total Emitido"
        value="$1.240.500"
        badge={{ text: '+4.2% vs mes anterior', color: 'green' }}
      />
    );

    expect(screen.getByText('+4.2% vs mes anterior')).toBeInTheDocument();
  });

  it('renders progress bar when progressBar prop is true', () => {
    const { container } = render(
      <StatsCard
        title="Total Recaudado"
        value="$892.300"
        progressBar={true}
        progressValue={72}
        progressLabel="72% del total emitido"
      />
    );

    expect(screen.getByText('72% del total emitido')).toBeInTheDocument();
    expect(container.querySelector(`.${styles.progressBar}`)).toBeInTheDocument();
  });

  it('does not render badge when not provided', () => {
    render(
      <StatsCard
        title="Pendiente de Cobro"
        value="$348.200"
      />
    );

    expect(screen.queryByText(/vs mes anterior/i)).not.toBeInTheDocument();
  });

  it('applies correct badge color class', () => {
    const { rerender } = render(
      <StatsCard
        title="Card"
        value="100"
        badge={{ text: 'badge green', color: 'green' }}
      />
    );

    expect(screen.getByText('badge green')).toHaveClass(styles.badge_green);

    rerender(
      <StatsCard
        title="Card"
        value="100"
        badge={{ text: 'badge red', color: 'red' }}
      />
    );

    expect(screen.getByText('badge red')).toHaveClass(styles.badge_red);

    rerender(
      <StatsCard
        title="Card"
        value="100"
        badge={{ text: 'badge orange', color: 'orange' }}
      />
    );

    expect(screen.getByText('badge orange')).toHaveClass(styles.badge_orange);
  });
});
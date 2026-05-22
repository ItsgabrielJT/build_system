import { render, screen } from '@testing-library/react';
import StatCardWithProgress from '../../components/StatCardWithProgress/StatCardWithProgress';

describe('StatCardWithProgress', () => {
  it('renderiza label, amount y budget correctamente', () => {
    render(
      <StatCardWithProgress
        label="Mantenimiento"
        amount={1250}
        budget={5000}
        percentage={25}
        overBudgetAmount={0}
      />
    );

    expect(screen.getByText('Mantenimiento')).toBeInTheDocument();
    expect(screen.getByText('$1,250.00')).toBeInTheDocument();
    expect(screen.getByText('/ $5,000 Budget')).toBeInTheDocument();
  });

  it('muestra barra de progreso con porcentaje correcto', () => {
    const { container } = render(
      <StatCardWithProgress
        label="Servicios"
        amount={3000}
        budget={5000}
        percentage={60}
        overBudgetAmount={0}
      />
    );

    const progressBar = container.querySelector('div[style="width: 60%;"]');
    expect(progressBar).toBeInTheDocument();
  });

  it('muestra badge Over Budget cuando percentage > 100', () => {
    render(
      <StatCardWithProgress
        label="Seguridad"
        amount={5500}
        budget={5000}
        percentage={110}
        overBudgetAmount={500}
      />
    );

    expect(screen.getByText('Over Budget')).toBeInTheDocument();
  });

  it('no muestra badge Over Budget cuando percentage <= 100', () => {
    render(
      <StatCardWithProgress
        label="Limpieza"
        amount={4000}
        budget={5000}
        percentage={80}
        overBudgetAmount={0}
      />
    );

    expect(screen.queryByText('Over Budget')).not.toBeInTheDocument();
  });

  it('muestra texto de porcentaje utilizado cuando no excede budget', () => {
    render(
      <StatCardWithProgress
        label="Administracion"
        amount={4500}
        budget={5000}
        percentage={90}
        overBudgetAmount={0}
      />
    );

    expect(screen.getByText('90% utilized')).toBeInTheDocument();
  });
});
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import styles from './MonthlyBalanceChart.module.css';

const BAR_COLORS = ['#0f9f6e', '#d92d20', '#1155d9'];

function formatCurrency(value) {
  return `$${Number(value || 0).toLocaleString('es-EC', {
    maximumFractionDigits: 0,
  })}`;
}

export default function MonthlyBalanceChart({ summary, loading = false }) {
  if (loading) {
    return <div className={styles.loading}>Cargando gráfica mensual...</div>;
  }

  if (!summary) {
    return <div className={styles.empty}>Sin datos del mes seleccionado.</div>;
  }

  const chartData = [
    { label: 'Ingresos', amount: Number(summary.income_total || 0) },
    { label: 'Gastos', amount: Number(summary.expense_total || 0) },
    { label: 'Neto', amount: Number(summary.net_balance || 0) },
  ];
  const incomeBreakdown = summary.income_breakdown || [];
  const expenseBreakdown = summary.expense_breakdown || [];

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div>
          <h3>Comparativo del mes</h3>
          <p>Ingresos, gastos y resultado neto consolidado.</p>
        </div>
        <span className={styles.pill}>{summary.period}</span>
      </div>

      <div className={styles.chartWrap}>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData}>
            <CartesianGrid stroke="#e7ebf2" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatCurrency(value)} />
            <Tooltip formatter={(value) => formatCurrency(value)} />
            <Bar dataKey="amount" radius={[10, 10, 0, 0]}>
              {chartData.map((item, index) => (
                <Cell key={item.label} fill={BAR_COLORS[index]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className={styles.breakdowns}>
        <div>
          <h4>Detalle de ingresos</h4>
          {incomeBreakdown.length ? (
            <ul>
              {incomeBreakdown.slice(0, 3).map((item) => (
                <li key={`${item.label}-${item.amount}`}>
                  <span>{item.label}</span>
                  <strong>{formatCurrency(item.amount)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p>Sin ingresos confirmados.</p>
          )}
        </div>
        <div>
          <h4>Detalle de gastos</h4>
          {expenseBreakdown.length ? (
            <ul>
              {expenseBreakdown.slice(0, 3).map((item) => (
                <li key={`${item.label}-${item.amount}`}>
                  <span>{item.label}</span>
                  <strong>{formatCurrency(item.amount)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p>Sin gastos registrados.</p>
          )}
        </div>
      </div>
    </section>
  );
}
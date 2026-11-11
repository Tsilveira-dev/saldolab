import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { money } from '../domain/finance';
import { EmptyState } from './ui';

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      {payload.map((item) => (
        <div key={item.dataKey ?? item.name}>
          <span className="legend-dot" style={{ background: item.color ?? item.payload.fill }} />
          {item.name}
          <b>{money(item.value)}</b>
        </div>
      ))}
    </div>
  );
}
const axis = {
  axisLine: false,
  tickLine: false,
  tick: { fill: '#86909c', fontSize: 11 },
  tickMargin: 12,
};
const tickMoney = (value) =>
  value === 0
    ? 'R$ 0'
    : `R$ ${(value / 100000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
export function ComparisonChart({ series, line = false }) {
  if (!series.some((item) => item.income || item.expense))
    return (
      <EmptyState
        title="Seu histórico começa aqui"
        description="Registre receitas e despesas para visualizar a evolução."
      />
    );
  const content = (
    <>
      <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 4" />
      <XAxis dataKey="label" {...axis} />
      <YAxis {...axis} width={68} tickFormatter={tickMoney} />
      <Tooltip content={<ChartTooltip />} cursor={line ? false : { fill: 'var(--chart-cursor)' }} />
      {line ? (
        <>
          <Line
            name="Receitas"
            dataKey="income"
            type="monotone"
            stroke="#4e9385"
            strokeWidth={2.5}
            dot={false}
          />
          <Line
            name="Despesas"
            dataKey="expense"
            type="monotone"
            stroke="#bbc9db"
            strokeWidth={2.5}
            dot={false}
          />
          <Line
            name="Resultado"
            dataKey="net"
            type="monotone"
            stroke="#c69e69"
            strokeWidth={2}
            dot={false}
          />
        </>
      ) : (
        <>
          <Bar
            name="Receitas"
            dataKey="income"
            fill="#4e9385"
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
          />
          <Bar
            name="Despesas"
            dataKey="expense"
            fill="#c1cddb"
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
          />
        </>
      )}
    </>
  );
  return (
    <div
      className="chart-area"
      role="img"
      aria-label="Gráfico de receitas e despesas dos últimos seis meses"
    >
      <ResponsiveContainer width="100%" height="100%">
        {line ? (
          <LineChart data={series} margin={{ top: 12, right: 8, left: -8, bottom: 4 }}>
            {content}
          </LineChart>
        ) : (
          <BarChart data={series} barGap={5} margin={{ top: 12, right: 8, left: -8, bottom: 4 }}>
            {content}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
export function ExpenseChart({ categories }) {
  const total = categories.reduce((sum, category) => sum + category.value, 0);
  if (!total)
    return (
      <EmptyState
        title="Nenhuma despesa no período"
        description="As despesas confirmadas aparecerão aqui."
      />
    );
  return (
    <div className="expense-chart">
      <div className="donut-wrap" role="img" aria-label={`Despesas totais: ${money(total)}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={categories}
              dataKey="value"
              nameKey="name"
              innerRadius="74%"
              outerRadius="95%"
              paddingAngle={3}
              cornerRadius={4}
              stroke="none"
              startAngle={90}
              endAngle={-270}
            >
              {categories.map((category) => (
                <Cell key={category.id} fill={category.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-label">
          <span>Total de despesas</span>
          <strong>{money(total)}</strong>
          <small>no período</small>
        </div>
      </div>
      <div className="category-legend">
        {categories.slice(0, 4).map((category) => (
          <div key={category.id}>
            <span>
              <i className="legend-dot" style={{ background: category.color }} />
              {category.name}
            </span>
            <strong>{Math.round((category.value / total) * 100)}%</strong>
          </div>
        ))}
        {categories.length > 4 && (
          <div className="other-categories">
            <span>Outras {categories.length - 4} categorias</span>
            <strong>
              {Math.round(
                (categories.slice(4).reduce((sum, category) => sum + category.value, 0) / total) *
                  100,
              )}
              %
            </strong>
          </div>
        )}
      </div>
    </div>
  );
}
export function ChartLegend({ line = false }) {
  return (
    <div className="chart-legend">
      <span>
        <i className="legend-dot" style={{ background: '#4e9385' }} />
        Receitas
      </span>
      <span>
        <i className="legend-dot" style={{ background: '#c1cddb' }} />
        Despesas
      </span>
      {line && (
        <span>
          <i className="legend-dot" style={{ background: '#c69e69' }} />
          Resultado
        </span>
      )}
    </div>
  );
}

import { useState } from 'react';
import { Download, Repeat2 } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import {
  filterTransactions,
  totals,
  categoryTotals,
  monthlySeries,
  recurringExpenses,
  money,
} from '../domain/finance';
import { downloadFile, transactionsCsv } from '../services/files';
import { PageHeading, Panel, CategoryIcon, EmptyState } from '../components/ui';
import { ComparisonChart, ChartLegend, ExpenseChart } from '../components/Charts';

export default function Reports() {
  const { data, accountId, month } = useFinance();
  const [range, setRange] = useState({ from: '', to: '' });
  const [type, setType] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const hasRange = Boolean(range.from || range.to);
  const invalidRange = Boolean(range.from && range.to && range.from > range.to);
  const filters = { accountId, type, categoryId, ...(hasRange ? range : { month }) };
  const filtered = invalidRange ? [] : filterTransactions(data.transactions, filters);
  const stats = totals(filtered);
  const categories = categoryTotals(filtered, data.categories);
  const recurring = recurringExpenses(
    filterTransactions(data.transactions, { accountId, type, categoryId, ...range }),
  );
  const series = monthlySeries(
    filterTransactions(data.transactions, { from: range.from, to: range.to }),
    range.to?.slice(0, 7) || month,
    6,
    { accountId, type, categoryId },
  );
  return (
    <>
      <PageHeading
        eyebrow="ANÁLISE FINANCEIRA"
        title="Clareza que vira decisão."
        description="Entenda seus hábitos e a evolução das suas finanças."
      />
      <div className="panel report-filters">
        <label>
          De
          <input
            className="form-control"
            type="date"
            value={range.from}
            onChange={(event) => setRange({ ...range, from: event.target.value })}
          />
        </label>
        <label>
          Até
          <input
            className="form-control"
            type="date"
            value={range.to}
            onChange={(event) => setRange({ ...range, to: event.target.value })}
          />
        </label>
        <label>
          Tipo
          <select
            className="form-select"
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <option value="">Todos os tipos</option>
            <option value="income">Receita</option>
            <option value="expense">Despesa</option>
            <option value="transfer">Transferência</option>
          </select>
        </label>
        <label>
          Categoria
          <select
            className="form-select"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">Todas as categorias</option>
            {data.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="btn btn-outline-secondary"
          disabled={invalidRange}
          onClick={() =>
            downloadFile(
              transactionsCsv(filtered, data.accounts, data.categories),
              'saldolab-relatorio.csv',
              'text/csv;charset=utf-8',
            )
          }
        >
          <Download size={16} />
          Exportar CSV
        </button>
        {hasRange && (
          <button className="btn btn-light" onClick={() => setRange({ from: '', to: '' })}>
            Usar mês selecionado
          </button>
        )}
      </div>
      {invalidRange && (
        <p className="field-error" role="alert">
          A data inicial deve ser anterior ou igual à data final.
        </p>
      )}
      <div className="inline-summary">
        <span>
          Receitas confirmadas<strong className="text-positive">{money(stats.income)}</strong>
        </span>
        <span>
          Despesas confirmadas<strong className="text-expense">{money(stats.expense)}</strong>
        </span>
        <span>
          Resultado<strong>{money(stats.net)}</strong>
        </span>
        <span>
          Movimentações<strong>{filtered.length}</strong>
        </span>
      </div>
      <div className="dashboard-main-grid">
        <Panel
          title="Evolução financeira"
          subtitle="Até 6 meses · filtros de tipo, categoria, conta e intervalo aplicados"
        >
          <ChartLegend line />
          <ComparisonChart series={invalidRange ? [] : series} line />
        </Panel>
        <Panel title="Distribuição por categoria" subtitle="Despesas confirmadas do período">
          <ExpenseChart categories={categories} />
        </Panel>
      </div>
      <div className="categories-grid">
        <Panel title="Maiores gastos" subtitle="Totais por categoria no período">
          <div className="category-list">
            {categories.length ? (
              categories.map((category, index) => (
                <div className="category-list-item" key={category.id}>
                  <span className="rank">{String(index + 1).padStart(2, '0')}</span>
                  <CategoryIcon name={category.icon} color={category.color} />
                  <strong className="flex-grow-1">{category.name}</strong>
                  <strong>{money(category.value)}</strong>
                </div>
              ))
            ) : (
              <EmptyState
                title="Sem despesas no período"
                description="Altere os filtros para consultar outro intervalo."
              />
            )}
          </div>
        </Panel>
        <Panel
          title="Hábitos recorrentes"
          subtitle="Descrições encontradas em pelo menos 3 meses distintos"
        >
          <div className="category-list">
            {recurring.length ? (
              recurring.map((item) => (
                <div key={item.description} className="category-list-item">
                  <Repeat2 size={19} />
                  <div className="flex-grow-1">
                    <strong>{item.description}</strong>
                    <small>{item.months} meses · média por lançamento</small>
                  </div>
                  <strong>{money(item.average)}</strong>
                </div>
              ))
            ) : (
              <EmptyState
                title="Seu histórico ainda está crescendo"
                description="A identificação de recorrência precisa de dados de pelo menos 3 meses."
              />
            )}
          </div>
          <p className="report-note">
            Recorrências usam o histórico disponível e os filtros de conta, tipo, categoria e datas.
            Sem intervalo personalizado, usam todo o histórico. Não representam previsão de gastos
            futuros.
          </p>
        </Panel>
      </div>
    </>
  );
}

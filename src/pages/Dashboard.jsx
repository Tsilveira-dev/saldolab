import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  ChartNoAxesCombined,
  ArrowRight,
  Clock3,
  TrendingUp,
  ChevronRight,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import {
  accountBalance,
  totalBalance,
  totals,
  filterTransactions,
  shiftMonth,
  monthlySeries,
  categoryTotals,
  budgetProgress,
  money,
  percentage,
  monthLabel,
} from '../domain/finance';
import { PageHeading, Panel, Change, BudgetBar, EmptyState } from '../components/ui';
import { ComparisonChart, ExpenseChart, ChartLegend } from '../components/Charts';
import TransactionTable from '../components/TransactionTable';

export default function Dashboard() {
  const { data, month, accountId, setEditor } = useFinance();
  const [line, setLine] = useState(false);
  const filtered = filterTransactions(data.transactions, { month, accountId });
  const stats = totals(filtered);
  const previous = totals(
    filterTransactions(data.transactions, { month: shiftMonth(month, -1), accountId }),
  );
  const account = data.accounts.find((account) => account.id === accountId);
  const balance = account
    ? accountBalance(account, data.transactions)
    : totalBalance(data.accounts, data.transactions);
  const categories = categoryTotals(filtered, data.categories);
  const budgets = data.budgets
    .filter((budget) => budget.month === month)
    .map((budget) => budgetProgress(budget, filterTransactions(data.transactions, { accountId })));
  const limit = budgets.reduce((sum, budget) => sum + budget.limitCents, 0);
  const spent = budgets.reduce((sum, budget) => sum + budget.spent, 0);
  const series = monthlySeries(data.transactions, month, 6, { accountId });
  const cards = [
    {
      label: 'Saldo disponível',
      value: balance,
      icon: Wallet,
      className: 'balance-card',
      footer: (
        <span className="balance-caption">
          <span />
          {accountId ? 'Na conta selecionada' : `Em ${data.accounts.length} contas financeiras`} ·
          saldo atual
        </span>
      ),
    },
    {
      label: 'Receitas do mês',
      value: stats.income,
      icon: ArrowDownLeft,
      className: 'income-card',
      footer: <Change value={stats.income} previous={previous.income} />,
    },
    {
      label: 'Despesas do mês',
      value: stats.expense,
      icon: ArrowUpRight,
      className: 'expense-card',
      footer: <Change value={stats.expense} previous={previous.expense} expense />,
    },
    {
      label: 'Resultado do mês',
      value: stats.net,
      icon: ChartNoAxesCombined,
      className: 'result-card',
      footer: (
        <span className="result-caption">
          <span className={stats.net >= 0 ? 'text-positive' : 'text-negative'}>
            {percentage(stats.net, stats.income).toFixed(1).replace('.', ',')}%
          </span>{' '}
          das receitas {stats.net >= 0 ? 'preservadas' : 'em déficit'}
        </span>
      ),
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow="SEU RESUMO FINANCEIRO"
        title="Tudo em equilíbrio."
        description="Acompanhe o presente. Planeje suas próximas conquistas."
        action={() => setEditor({ entity: 'transactions' })}
        label="Nova transação"
      />
      <div className="metrics-grid">
        {cards.map(({ label, value, icon: Icon, className, footer }) => (
          <section key={label} className={`metric-card ${className}`} aria-label={label}>
            <div className="metric-heading">
              <span>{label}</span>
              <span className="metric-icon">
                <Icon size={18} strokeWidth={1.7} />
              </span>
            </div>
            <strong className="metric-value">{money(value)}</strong>
            {footer}
          </section>
        ))}
      </div>
      <div className="dashboard-main-grid">
        <Panel
          title="Entradas e saídas"
          subtitle={`Seu movimento nos últimos 6 meses · até ${monthLabel(month)}`}
          action={
            <div className="chart-switch" aria-label="Tipo de gráfico">
              <button
                className={!line ? 'selected' : ''}
                onClick={() => setLine(false)}
                aria-pressed={!line}
              >
                Barras
              </button>
              <button
                className={line ? 'selected' : ''}
                onClick={() => setLine(true)}
                aria-pressed={line}
              >
                Evolução
              </button>
            </div>
          }
        >
          <ChartLegend line={line} />
          <ComparisonChart series={series} line={line} />
          <div className="chart-footnote">
            <TrendingUp size={14} />
            <span>
              {stats.net >= 0
                ? 'O resultado do período está positivo.'
                : 'As despesas superaram as receitas neste período.'}{' '}
              Continue acompanhando.
            </span>
          </div>
        </Panel>
        <Panel
          title="Para onde vai seu dinheiro"
          subtitle="Distribuição das despesas confirmadas"
          action={
            <Link className="icon-button" to="/relatorios" aria-label="Ver relatório de despesas">
              <ArrowUpRight size={19} />
            </Link>
          }
        >
          <ExpenseChart categories={categories} />
        </Panel>
      </div>
      <div className="dashboard-lower-grid">
        <Panel
          title="Últimas transações"
          subtitle={`${filtered.length} movimentações no período`}
          action={
            <Link className="text-link" to="/transacoes">
              Ver todas <ArrowRight size={15} />
            </Link>
          }
        >
          <TransactionTable
            transactions={[...filtered]
              .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
              .slice(0, 5)}
            compact
          />
        </Panel>
        <Panel
          title="Seu planejamento"
          subtitle="Orçamentos do mês"
          action={
            <Link className="icon-button" to="/orcamentos" aria-label="Gerenciar orçamentos">
              <ArrowUpRight size={19} />
            </Link>
          }
        >
          <div className="budget-panel-body">
            {budgets.length ? (
              <>
                <div className="budget-summary">
                  <span>
                    <strong>{Math.round(percentage(spent, limit))}%</strong>
                    <small>do orçamento utilizado</small>
                  </span>
                  <span className="budget-summary-icon">
                    <ChartNoAxesCombined size={21} />
                  </span>
                </div>
                {budgets.slice(0, 3).map((budget) => (
                  <BudgetBar
                    key={budget.id}
                    item={budget}
                    category={data.categories.find((category) => category.id === budget.categoryId)}
                    showRemaining={false}
                  />
                ))}
                <Link className="budget-all-link" to="/orcamentos">
                  Acompanhar orçamentos <ChevronRight size={15} />
                </Link>
              </>
            ) : (
              <EmptyState
                title="Dê um destino ao seu dinheiro"
                description="Defina limites para suas categorias."
                action={() => setEditor({ entity: 'budgets' })}
                label="Criar orçamento"
              />
            )}
          </div>
        </Panel>
      </div>
      <div className="pending-notice">
        <span className="pending-notice-icon">
          <Clock3 size={18} />
        </span>
        <div>
          <strong>
            {stats.pendingCount
              ? `${stats.pendingCount} lançamentos pendentes`
              : 'Tudo em dia por aqui'}
          </strong>
          <span>
            {stats.pendingCount
              ? `${money(stats.pendingCents)} aguardando confirmação. Esses valores ainda não alteram seu saldo.`
              : 'Nenhum lançamento aguardando confirmação neste período.'}
          </span>
        </div>
        <Link to="/transacoes?status=pending" className="text-link">
          Conferir <ArrowRight size={15} />
        </Link>
      </div>
    </>
  );
}

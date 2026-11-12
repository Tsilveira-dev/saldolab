import { useFinance } from '../context/FinanceContext';
import { budgetProgress, filterTransactions, money, percentage } from '../domain/finance';
import { PageHeading, EmptyState, BudgetBar, RowActions } from '../components/ui';
export default function Budgets() {
  const { data, month, accountId, setEditor, remove } = useFinance();
  const budgets = data.budgets
    .filter((budget) => budget.month === month)
    .map((record) => ({
      record,
      progress: budgetProgress(record, filterTransactions(data.transactions, { accountId })),
    }));
  const spent = budgets.reduce((sum, { progress }) => sum + progress.spent, 0);
  const limit = budgets.reduce((sum, { record }) => sum + record.limitCents, 0);
  return (
    <>
      <PageHeading
        eyebrow="PLANEJAMENTO MENSAL"
        title="Seu dinheiro com direção."
        description="Defina limites e acompanhe seus gastos com tranquilidade."
        action={() => setEditor({ entity: 'budgets' })}
        label="Novo orçamento"
      />
      <div className="inline-summary">
        <span>
          Total planejado<strong>{money(limit)}</strong>
        </span>
        <span>
          Utilizado<strong>{money(spent)}</strong>
        </span>
        <span>
          Disponível
          <strong className={limit >= spent ? 'text-positive' : 'text-negative'}>
            {money(limit - spent)}
          </strong>
        </span>
        <span>
          Consumo<strong>{Math.round(percentage(spent, limit))}%</strong>
        </span>
      </div>
      {accountId && (
        <p className="page-tip">
          Gastos filtrados pela conta selecionada. Os limites são definidos para todas as contas.
        </p>
      )}
      {budgets.length ? (
        <div className="budget-grid">
          {budgets.map(({ record, progress: budget }) => {
            const category = data.categories.find((category) => category.id === budget.categoryId);
            return (
              <article className="panel budget-card" key={budget.id}>
                <div className="budget-card-heading">
                  <span
                    className={`budget-status ${budget.percent >= 100 ? 'over' : budget.percent >= 80 ? 'near' : ''}`}
                  >
                    {budget.percent >= 100
                      ? 'Limite atingido'
                      : budget.percent >= 80
                        ? 'Perto do limite'
                        : 'Dentro do planejado'}
                  </span>
                  <RowActions
                    name={`orçamento ${category?.name}`}
                    onEdit={() => setEditor({ entity: 'budgets', row: record })}
                    onDelete={() => remove('budgets', record)}
                  />
                </div>
                <BudgetBar item={budget} category={category} />
              </article>
            );
          })}
        </div>
      ) : (
        <section className="panel">
          <EmptyState
            title="Planeje o seu mês"
            description="Crie um orçamento para acompanhar os limites de cada categoria."
            action={() => setEditor({ entity: 'budgets' })}
            label="Criar orçamento"
          />
        </section>
      )}
    </>
  );
}

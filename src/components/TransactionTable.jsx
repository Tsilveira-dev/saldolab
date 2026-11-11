import { money, shortDate } from '../domain/finance';
import { useFinance } from '../context/FinanceContext';
import { CategoryIcon, TypeIcon, RowActions, EmptyState } from './ui';

export default function TransactionTable({ transactions, compact = false }) {
  const { data, setEditor, remove } = useFinance();
  if (!transactions.length)
    return (
      <EmptyState
        title="Nenhuma transação encontrada"
        description="Tente outro período ou adicione uma movimentação."
        action={() => setEditor({ entity: 'transactions' })}
        label="Adicionar transação"
      />
    );
  return (
    <div className="table-responsive transaction-table-wrap">
      <table className={`table transaction-table ${compact ? 'compact' : ''}`}>
        <thead>
          <tr>
            <th scope="col">Descrição</th>
            <th scope="col">Categoria</th>
            {!compact && (
              <th scope="col" className="account-column">
                Conta
              </th>
            )}
            <th scope="col">Data</th>
            <th scope="col">Status</th>
            <th scope="col" className="text-end">
              Valor
            </th>
            {!compact && (
              <th scope="col">
                <span className="visually-hidden">Ações</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => {
            const category = data.categories.find((row) => row.id === tx.categoryId);
            const account = data.accounts.find((row) => row.id === tx.accountId);
            const destination = data.accounts.find((row) => row.id === tx.destinationAccountId);
            return (
              <tr key={tx.id}>
                <td>
                  <div className="transaction-description">
                    <TypeIcon type={tx.type} />
                    <span>
                      <strong>{tx.description}</strong>
                      <small>
                        {tx.type === 'transfer'
                          ? `${account?.name} → ${destination?.name}`
                          : tx.type === 'income'
                            ? 'Receita'
                            : 'Despesa'}
                      </small>
                    </span>
                  </div>
                </td>
                <td>
                  <span className="category-pill">
                    <CategoryIcon
                      name={category?.icon ?? 'wallet'}
                      color={category?.color ?? '#7797b4'}
                      size={13}
                    />
                    {category?.name ?? 'Transferência'}
                  </span>
                </td>
                {!compact && (
                  <td className="account-column">
                    <span className="account-name-dot" style={{ background: account?.color }} />
                    {account?.name}
                  </td>
                )}
                <td className="date-cell">
                  {shortDate(tx.date)}
                  <small>{tx.date.slice(0, 4)}</small>
                </td>
                <td>
                  <span className={`status-pill ${tx.status}`}>
                    <i />
                    {tx.status === 'confirmed' ? 'Confirmado' : 'Pendente'}
                  </span>
                </td>
                <td
                  className={`transaction-amount text-end ${tx.type === 'income' ? 'text-positive' : tx.type === 'expense' ? 'text-expense' : ''}`}
                >
                  {tx.type === 'income' ? '+' : tx.type === 'expense' ? '−' : ''}{' '}
                  {money(tx.amountCents)}
                </td>
                {!compact && (
                  <td>
                    <RowActions
                      name={tx.description}
                      onEdit={() => setEditor({ entity: 'transactions', row: tx })}
                      onDelete={() => remove('transactions', tx)}
                    />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

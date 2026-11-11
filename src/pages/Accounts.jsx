import { Wallet, ArrowUpRight } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { accountBalance, totalBalance, money } from '../domain/finance';
import { CategoryIcon, EmptyState, PageHeading, RowActions } from '../components/ui';
const types = {
  checking: 'Conta corrente',
  digital: 'Conta digital',
  savings: 'Poupança / reserva',
  cash: 'Carteira',
};
export default function Accounts() {
  const { data, setEditor, remove } = useFinance();
  return (
    <>
      <PageHeading
        eyebrow="SEU PATRIMÔNIO"
        title="Um lugar para cada conta."
        description="Saldos atuais calculados com todas as movimentações confirmadas."
        action={() => setEditor({ entity: 'accounts' })}
        label="Adicionar conta"
      />
      <div className="accounts-total">
        <span className="total-icon">
          <Wallet size={24} />
        </span>
        <div>
          <span>Saldo total disponível</span>
          <strong>{money(totalBalance(data.accounts, data.transactions))}</strong>
        </div>
        <small>{data.accounts.length} contas cadastradas</small>
      </div>
      {data.accounts.length ? (
        <div className="account-grid">
          {data.accounts.map((account) => (
            <article className="panel account-card" key={account.id}>
              <div className="account-card-top">
                <CategoryIcon name={account.icon} color={account.color} size={24} />
                <RowActions
                  name={account.name}
                  onEdit={() => setEditor({ entity: 'accounts', row: account })}
                  onDelete={() => remove('accounts', account)}
                />
              </div>
              <h2>{account.name}</h2>
              <p>{types[account.type]}</p>
              <div className="account-balance">
                <small>Saldo disponível</small>
                <strong>{money(accountBalance(account, data.transactions))}</strong>
              </div>
              <div className="account-card-footer">
                <span>Saldo inicial: {money(account.initialBalanceCents)}</span>
                <ArrowUpRight size={17} aria-hidden="true" />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="panel">
          <EmptyState
            title="Vamos organizar suas contas?"
            description="Cadastre uma conta corrente, reserva ou carteira para começar."
            action={() => setEditor({ entity: 'accounts' })}
            label="Adicionar conta"
          />
        </section>
      )}
      <p className="page-tip">
        Transferências movimentam valores entre contas e não são contabilizadas como receitas ou
        despesas.
      </p>
    </>
  );
}

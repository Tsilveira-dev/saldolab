import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Download, SlidersHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { filterTransactions, totals, money } from '../domain/finance';
import { transactionsCsv, downloadFile } from '../services/files';
import { PageHeading } from '../components/ui';
import TransactionTable from '../components/TransactionTable';

export default function Transactions() {
  const { data, month, accountId, setEditor } = useFinance();
  const [params] = useSearchParams();
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [categoryId, setCategoryId] = useState('');
  const [sort, setSort] = useState('date-desc');
  const [page, setPage] = useState(1);
  const filtered = filterTransactions(data.transactions, {
    month,
    accountId,
    type,
    status,
    categoryId,
    search,
  });
  const sorted = [...filtered].sort((a, b) =>
    sort === 'amount-desc'
      ? b.amountCents - a.amountCents
      : sort === 'description'
        ? a.description.localeCompare(b.description, 'pt-BR')
        : sort === 'date-asc'
          ? a.date.localeCompare(b.date)
          : b.date.localeCompare(a.date),
  );
  const pages = Math.max(1, Math.ceil(sorted.length / 10));
  const activePage = Math.min(page, pages);
  const stats = totals(filtered);
  const selectFilter = (setter) => (event) => {
    setter(event.target.value);
    setPage(1);
  };
  return (
    <>
      <PageHeading
        eyebrow="MOVIMENTAÇÕES"
        title="Cada movimento conta."
        description="Organize as entradas e saídas do seu dia a dia."
        action={() => setEditor({ entity: 'transactions' })}
        label="Nova transação"
      />
      <div className="inline-summary">
        <span>
          Receitas <strong className="text-positive">{money(stats.income)}</strong>
        </span>
        <span>
          Despesas <strong className="text-expense">{money(stats.expense)}</strong>
        </span>
        <span>
          Resultado <strong>{money(stats.net)}</strong>
        </span>
        <span>
          Pendentes <strong>{stats.pendingCount}</strong>
        </span>
      </div>
      <section className="panel">
        <div className="transactions-toolbar">
          <label className="search-field">
            <Search size={17} />
            <span className="visually-hidden">Buscar transações</span>
            <input
              type="search"
              value={search}
              onChange={selectFilter(setSearch)}
              placeholder="Buscar transações…"
            />
          </label>
          <button
            className="btn btn-outline-secondary"
            onClick={() =>
              downloadFile(
                transactionsCsv(sorted, data.accounts, data.categories),
                `saldolab-transacoes-${month}.csv`,
                'text/csv;charset=utf-8',
              )
            }
          >
            <Download size={16} />
            Exportar CSV
          </button>
        </div>
        <div className="filter-row">
          <SlidersHorizontal size={16} aria-hidden="true" />
          <label>
            <span className="visually-hidden">Tipo de transação</span>
            <select className="form-select" value={type} onChange={selectFilter(setType)}>
              <option value="">Todos os tipos</option>
              <option value="income">Receitas</option>
              <option value="expense">Despesas</option>
              <option value="transfer">Transferências</option>
            </select>
          </label>
          <label>
            <span className="visually-hidden">Categoria da transação</span>
            <select
              className="form-select"
              value={categoryId}
              onChange={selectFilter(setCategoryId)}
            >
              <option value="">Todas as categorias</option>
              {data.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="visually-hidden">Status da transação</span>
            <select className="form-select" value={status} onChange={selectFilter(setStatus)}>
              <option value="">Todos os status</option>
              <option value="confirmed">Confirmados</option>
              <option value="pending">Pendentes</option>
            </select>
          </label>
          <label className="sort-filter">
            <span className="visually-hidden">Ordenar transações</span>
            <select className="form-select" value={sort} onChange={selectFilter(setSort)}>
              <option value="date-desc">Mais recentes</option>
              <option value="date-asc">Mais antigas</option>
              <option value="amount-desc">Maior valor</option>
              <option value="description">Descrição A–Z</option>
            </select>
          </label>
        </div>
        <TransactionTable transactions={sorted.slice((activePage - 1) * 10, activePage * 10)} />
        <div className="pagination-footer">
          <span>
            {sorted.length
              ? `${(activePage - 1) * 10 + 1}–${Math.min(activePage * 10, sorted.length)} de ${sorted.length}`
              : '0'}{' '}
            transações
          </span>
          <div>
            <button
              className="icon-button"
              disabled={activePage <= 1}
              aria-label="Página anterior"
              onClick={() => setPage(activePage - 1)}
            >
              <ChevronLeft size={17} />
            </button>
            <span>
              {activePage} de {pages}
            </span>
            <button
              className="icon-button"
              disabled={activePage >= pages}
              aria-label="Próxima página"
              onClick={() => setPage(activePage + 1)}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

import { describe, expect, it, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import FinanceProvider from '../context/FinanceProvider';
import Layout from '../app/Layout';
import Dashboard from '../pages/Dashboard';
import Transactions from '../pages/Transactions';
import Accounts from '../pages/Accounts';
import Categories from '../pages/Categories';
import Budgets from '../pages/Budgets';
import Settings from '../pages/Settings';
import { storageKey, createLocalRepository } from '../repositories/localRepository';
import { currentMonth, today } from '../domain/finance';

// SVG layout is a browser concern; these tests keep all financial and form logic real.
vi.mock('../components/Charts', () => ({
  ComparisonChart: () => <div>Gráfico de comparação</div>,
  ExpenseChart: () => <div>Distribuição de despesas</div>,
  ChartLegend: () => null,
}));

const fixture = () => ({
  version: 1,
  accounts: [
    {
      id: 'main',
      name: 'Conta teste',
      type: 'checking',
      initialBalanceCents: 100000,
      color: '#123456',
      icon: 'bank',
      createdAt: today(),
    },
    {
      id: 'reserve',
      name: 'Reserva teste',
      type: 'savings',
      initialBalanceCents: 0,
      color: '#123456',
      icon: 'wallet',
      createdAt: today(),
    },
  ],
  categories: [
    { id: 'salary', name: 'Salário teste', type: 'income', color: '#123456', icon: 'briefcase' },
    { id: 'food', name: 'Alimentação teste', type: 'expense', color: '#123456', icon: 'food' },
  ],
  transactions: [],
  budgets: [],
});
async function setup(path = '/', data = fixture()) {
  window.localStorage.setItem(storageKey('personal'), JSON.stringify(data));
  window.localStorage.setItem(
    'saldolab:preferences:v1',
    JSON.stringify({ mode: 'personal', theme: 'light' }),
  );
  await createLocalRepository({ mode: 'personal' }).startEditing();
  const user = userEvent.setup();
  const view = render(
    <MemoryRouter initialEntries={[path]}>
      <FinanceProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="transacoes" element={<Transactions />} />
            <Route path="contas" element={<Accounts />} />
            <Route path="categorias" element={<Categories />} />
            <Route path="orcamentos" element={<Budgets />} />
            <Route path="configuracoes" element={<Settings />} />
          </Route>
        </Routes>
      </FinanceProvider>
    </MemoryRouter>,
  );
  return { user, ...view };
}
const saved = () => JSON.parse(window.localStorage.getItem(storageKey('personal')));
async function addTransaction(
  user,
  { type = 'expense', description = 'Compra teste', amount = '50,25', status = 'confirmed' } = {},
) {
  await user.click(screen.getByRole('button', { name: 'Nova transação' }));
  const dialog = within(screen.getByRole('dialog'));
  await user.selectOptions(dialog.getByLabelText('Tipo de movimentação'), type);
  await user.type(dialog.getByLabelText('Descrição'), description);
  await user.type(dialog.getByLabelText('Valor (R$)'), amount);
  await user.selectOptions(
    dialog.getByLabelText('Categoria'),
    type === 'income' ? 'salary' : 'food',
  );
  await user.selectOptions(dialog.getByLabelText('Status'), status);
  await user.click(dialog.getByRole('button', { name: 'Adicionar registro' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
}
describe('fluxos integrados React → formulário → repositório → indicadores', () => {
  it('cadastra receita e despesa e atualiza o dashboard imediatamente', async () => {
    const { user } = await setup();
    await screen.findByRole('heading', { name: 'Tudo em equilíbrio.' });
    await addTransaction(user, { type: 'income', description: 'Receita teste', amount: '500,10' });
    expect(
      within(screen.getByRole('region', { name: 'Receitas do mês' })).getByText(/500,10/),
    ).toBeInTheDocument();
    await addTransaction(user, { description: 'Despesa teste', amount: '50,25' });
    expect(
      within(screen.getByRole('region', { name: 'Despesas do mês' })).getByText(/50,25/),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Saldo disponível' })).getByText(/1\.449,85/),
    ).toBeInTheDocument();
    expect(saved().transactions.map((row) => row.amountCents)).toEqual([50010, 5025]);
  });
  it('edita e exclui após confirmação, atualizando armazenamento e tabela', async () => {
    const data = fixture();
    data.transactions.push({
      id: 'tx',
      description: 'Compra original',
      type: 'expense',
      amountCents: 1500,
      categoryId: 'food',
      accountId: 'main',
      destinationAccountId: null,
      date: today(),
      status: 'confirmed',
      notes: '',
    });
    const { user } = await setup('/transacoes', data);
    await screen.findByText('Compra original');
    await user.click(screen.getByRole('button', { name: 'Editar Compra original' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.clear(dialog.getByLabelText('Descrição'));
    await user.type(dialog.getByLabelText('Descrição'), 'Compra editada');
    await user.clear(dialog.getByLabelText('Valor (R$)'));
    await user.type(dialog.getByLabelText('Valor (R$)'), '25,10');
    await user.click(dialog.getByRole('button', { name: 'Salvar alterações' }));
    await screen.findByText('Compra editada');
    expect(saved().transactions[0].amountCents).toBe(2510);
    await user.click(screen.getByRole('button', { name: 'Excluir Compra editada' }));
    expect(saved().transactions).toHaveLength(1);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
    expect(saved().transactions).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Excluir Compra editada' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir registro' }),
    );
    await screen.findByText('Nenhuma transação encontrada');
    expect(saved().transactions).toEqual([]);
  });
  it('valida valor positivo antes de permitir qualquer gravação', async () => {
    const { user } = await setup('/transacoes');
    await screen.findByRole('heading', { name: 'Cada movimento conta.' });
    await user.click(screen.getByRole('button', { name: 'Nova transação' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.type(dialog.getByLabelText('Valor (R$)'), '0');
    await user.click(dialog.getByRole('button', { name: 'Adicionar registro' }));
    expect(await dialog.findByText('O valor deve ser maior que zero.')).toBeInTheDocument();
    expect(saved().transactions).toEqual([]);
  });
  it('registra pendência sem alterar o saldo disponível', async () => {
    const { user } = await setup();
    await screen.findByRole('heading', { name: 'Tudo em equilíbrio.' });
    await addTransaction(user, { status: 'pending' });
    expect(
      within(screen.getByRole('region', { name: 'Saldo disponível' })).getByText(/1\.000,00/),
    ).toBeInTheDocument();
    expect(screen.getByText('1 lançamentos pendentes')).toBeInTheDocument();
  });
  it('impede transferir para a própria conta e permite destino distinto', async () => {
    const { user } = await setup('/transacoes');
    await screen.findByRole('heading', { name: 'Cada movimento conta.' });
    await user.click(screen.getByRole('button', { name: 'Nova transação' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.selectOptions(dialog.getByLabelText('Tipo de movimentação'), 'transfer');
    await user.type(dialog.getByLabelText('Descrição'), 'Reserva mensal');
    await user.type(dialog.getByLabelText('Valor (R$)'), '200,00');
    await user.selectOptions(dialog.getByLabelText('Conta de destino'), 'main');
    await user.click(dialog.getByRole('button', { name: 'Adicionar registro' }));
    expect(await dialog.findByText('Escolha uma conta diferente da origem.')).toBeInTheDocument();
    expect(saved().transactions).toEqual([]);
    await user.selectOptions(dialog.getByLabelText('Conta de destino'), 'reserve');
    await user.click(dialog.getByRole('button', { name: 'Adicionar registro' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(saved().transactions[0]).toMatchObject({
      amountCents: 20000,
      categoryId: null,
      destinationAccountId: 'reserve',
    });
  });
  it('combina busca, tipo e período na tabela', async () => {
    const data = fixture();
    data.transactions.push(
      ...['Mercado', 'Cinema'].map((description, i) => ({
        id: `tx${i}`,
        description,
        type: 'expense',
        amountCents: 1500,
        categoryId: 'food',
        accountId: 'main',
        destinationAccountId: null,
        date: today(),
        status: 'confirmed',
        notes: '',
      })),
    );
    const { user } = await setup('/transacoes', data);
    await screen.findByText('Mercado');
    await user.type(screen.getByLabelText('Buscar transações'), 'mercado');
    expect(screen.queryByText('Cinema')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Tipo de transação'), 'income');
    expect(screen.getByText('Nenhuma transação encontrada')).toBeInTheDocument();
  });
  it('cria conta e categoria com personalização e mantém seus dados', async () => {
    const { user } = await setup('/contas');
    await screen.findByRole('heading', { name: 'Um lugar para cada conta.' });
    await user.click(screen.getAllByRole('button', { name: 'Adicionar conta' })[0]);
    let dialog = within(screen.getByRole('dialog'));
    await user.type(dialog.getByLabelText('Nome da conta'), 'Carteira de viagem');
    await user.selectOptions(dialog.getByLabelText('Tipo da conta'), 'cash');
    expect(dialog.getByLabelText('Saldo inicial (R$)')).toHaveValue('');
    await user.type(dialog.getByLabelText('Saldo inicial (R$)'), '125,50');
    await user.click(dialog.getByRole('button', { name: 'Adicionar registro' }));
    await screen.findByRole('heading', { name: 'Carteira de viagem' });
    expect(saved().accounts).toHaveLength(3);
    await user.click(screen.getByRole('link', { name: 'Categorias' }));
    await screen.findByRole('heading', { name: 'Tudo no seu lugar.' });
    await user.click(screen.getByRole('button', { name: 'Nova categoria' }));
    dialog = within(screen.getByRole('dialog'));
    await user.type(dialog.getByLabelText('Nome da categoria'), 'Viagens');
    await user.selectOptions(dialog.getByLabelText('Ícone'), 'car');
    await user.click(dialog.getByRole('button', { name: 'Adicionar registro' }));
    await screen.findByText('Viagens');
    expect(saved().categories.at(-1)).toMatchObject({ name: 'Viagens', icon: 'car' });
  });
  it('cria orçamento e apresenta validação de duplicidade', async () => {
    const { user } = await setup('/orcamentos');
    await screen.findByRole('heading', { name: 'Seu dinheiro com direção.' });
    for (let index = 0; index < 2; index++) {
      await user.click(screen.getByRole('button', { name: 'Novo orçamento' }));
      const dialog = within(screen.getByRole('dialog'));
      await user.selectOptions(dialog.getByLabelText('Categoria de despesa'), 'food');
      await user.type(dialog.getByLabelText('Limite mensal (R$)'), '800,00');
      await user.click(dialog.getByRole('button', { name: 'Adicionar registro' }));
      if (index === 0)
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    }
    expect(
      await screen.findByText('Já existe um orçamento para essa categoria e mês.'),
    ).toBeInTheDocument();
    expect(saved().budgets).toHaveLength(1);
    expect(saved().budgets[0].month).toBe(currentMonth());
  });
  it('alterna modos sem misturar dados e preserva a preferência no recarregamento', async () => {
    const { user, unmount } = await setup();
    await screen.findByRole('heading', { name: 'Tudo em equilíbrio.' });
    await user.selectOptions(screen.getByLabelText('Modo de uso'), 'demo');
    await screen.findByText('Cinema com amigos');
    expect(JSON.parse(window.localStorage.getItem(storageKey('personal'))).transactions).toEqual(
      [],
    );
    await user.selectOptions(screen.getByLabelText('Modo de uso'), 'personal');
    await screen.findByText('Nenhuma transação encontrada');
    expect(screen.getByLabelText('Modo de uso')).toHaveValue('personal');
    unmount();
    render(
      <MemoryRouter>
        <FinanceProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
            </Route>
          </Routes>
        </FinanceProvider>
      </MemoryRouter>,
    );
    await screen.findByText('Nenhuma transação encontrada');
    expect(screen.getByLabelText('Modo de uso')).toHaveValue('personal');
  });
  it('recupera visualmente erros de armazenamento sem sobrescrever o original', async () => {
    window.localStorage.setItem(storageKey('demo'), '{bad');
    render(
      <MemoryRouter>
        <FinanceProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
            </Route>
          </Routes>
        </FinanceProvider>
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole('heading', { name: 'Seus dados precisam de atenção' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exportar conteúdo original' })).toBeInTheDocument();
    expect(window.localStorage.getItem(storageKey('demo'))).toBe('{bad');
  });
});

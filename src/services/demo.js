import { currentMonth, shiftMonth, today } from '../domain/finance';

export const emptyDataset = () => ({
  version: 1,
  accounts: [],
  categories: [],
  transactions: [],
  budgets: [],
});
export function createDemoData(month = currentMonth()) {
  const categories = [
    ['salary', 'Salário', 'income', '#40876c', 'briefcase'],
    ['freelance', 'Freelance', 'income', '#619785', 'chart'],
    ['investments', 'Investimentos', 'income', '#3d7c93', 'chart'],
    ['other-income', 'Outras receitas', 'income', '#779b7e', 'tag'],
    ['food', 'Alimentação', 'expense', '#408f88', 'food'],
    ['housing', 'Moradia', 'expense', '#4d6386', 'home'],
    ['transport', 'Transporte', 'expense', '#d4a263', 'car'],
    ['education', 'Educação', 'expense', '#9084b5', 'book'],
    ['health', 'Saúde', 'expense', '#bc8594', 'heart'],
    ['leisure', 'Lazer', 'expense', '#7b9eb6', 'coffee'],
    ['subscriptions', 'Assinaturas', 'expense', '#ad9b7e', 'credit'],
    ['other-expense', 'Outras despesas', 'expense', '#9ca5ad', 'shopping'],
  ].map(([id, name, type, color, icon]) => ({ id, name, type, color, icon }));
  const accounts = [
    {
      id: 'checking',
      name: 'Conta principal',
      type: 'checking',
      initialBalanceCents: 320000,
      color: '#3d6686',
      icon: 'bank',
      createdAt: `${shiftMonth(month, -6)}-01`,
    },
    {
      id: 'digital',
      name: 'Conta digital',
      type: 'digital',
      initialBalanceCents: 85000,
      color: '#826ca5',
      icon: 'credit',
      createdAt: `${shiftMonth(month, -6)}-01`,
    },
    {
      id: 'savings',
      name: 'Reserva de emergência',
      type: 'savings',
      initialBalanceCents: 500000,
      color: '#4a8d79',
      icon: 'wallet',
      createdAt: `${shiftMonth(month, -6)}-01`,
    },
  ];
  const transactions = [];
  const add = (
    m,
    day,
    description,
    amountCents,
    categoryId,
    accountId = 'checking',
    status = 'confirmed',
    type = 'expense',
    destinationAccountId = null,
  ) =>
    transactions.push({
      id: `demo-${transactions.length + 1}`,
      description,
      type,
      amountCents,
      categoryId,
      accountId,
      destinationAccountId,
      date: `${m}-${String(day).padStart(2, '0')}`,
      status,
      notes: '',
    });
  for (let index = 5; index >= 0; index--) {
    const m = shiftMonth(month, -index);
    add(m, 2, 'Salário mensal', 840000, 'salary', 'checking', 'confirmed', 'income');
    add(
      m,
      5,
      'Projeto freelance',
      (1200 + (5 - index) * 170) * 100,
      'freelance',
      'digital',
      'confirmed',
      'income',
    );
    add(m, 3, 'Aluguel do apartamento', 195000, 'housing');
    add(m, 4, 'Supermercado', 38990 + index * 210, 'food');
    add(m, 6, 'Internet residencial', 11990, 'housing');
    add(m, 7, 'Plano de saúde', 42000, 'health');
    add(m, 7, 'Assinatura de streaming', 3990, 'subscriptions', 'digital');
    add(m, 8, 'Combustível', 18000 + index * 500, 'transport');
    add(m, 9, 'Café e almoço', 6850, 'food', 'digital');
    add(m, 10, 'Curso de desenvolvimento', 18900, 'education', 'digital');
    add(m, 10, 'Restaurante', 14500, 'food');
    add(m, 11, 'Cinema com amigos', 8800, 'leisure', 'digital');
    add(m, 12, 'Reserva mensal', 100000, null, 'checking', 'confirmed', 'transfer', 'savings');
    add(
      m,
      18,
      'Conta de energia',
      18250 + index * 300,
      'housing',
      'checking',
      index === 0 ? 'pending' : 'confirmed',
    );
    add(m, 22, 'Compras do mês', 25890, 'food', 'checking', index === 0 ? 'pending' : 'confirmed');
  }
  return {
    version: 1,
    accounts,
    categories,
    transactions,
    budgets: [
      ['food', 90000],
      ['housing', 250000],
      ['transport', 40000],
      ['leisure', 30000],
    ].map(([categoryId, limitCents], i) => ({ id: `budget-${i}`, categoryId, limitCents, month })),
  };
}
export const newId = () => crypto.randomUUID();
export const newAccount = (data) => ({ ...data, id: newId(), createdAt: today() });

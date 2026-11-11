import { format, parseISO, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const money = (cents) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
export const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
export const currentMonth = () => today().slice(0, 7);
export const shortDate = (date) => format(parseISO(date), 'dd MMM', { locale: ptBR });
export const monthLabel = (month) => format(parseISO(`${month}-01`), 'MMMM yyyy', { locale: ptBR });
export const shiftMonth = (month, delta) =>
  format(subMonths(parseISO(`${month}-01`), -delta), 'yyyy-MM');
export const centsInput = (cents) => (cents / 100).toFixed(2).replace('.', ',');

export function parseMoney(input) {
  if (typeof input !== 'string') throw new Error('Informe um valor monetário.');
  let value = input.trim().replace(/^R\$\s*/, '');
  if (value.includes(',')) {
    if (!/^-?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{1,2}$/.test(value))
      throw new Error('Use um valor como 150,00.');
    value = value.replaceAll('.', '').replace(',', '.');
  }
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(value)) throw new Error('Use no máximo duas casas decimais.');
  const negative = value.startsWith('-');
  const [whole, fraction = ''] = value.replace('-', '').split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || Math.abs(cents) > 100_000_000_000)
    throw new Error('Valor fora do limite permitido.');
  return negative ? -cents : cents;
}

export function filterTransactions(transactions, filters = {}) {
  const { month, from, to, accountId, categoryId, type, status, search } = filters;
  const term = search?.trim().toLocaleLowerCase('pt-BR');
  return transactions.filter(
    (tx) =>
      (!month || tx.date.startsWith(month)) &&
      (!from || tx.date >= from) &&
      (!to || tx.date <= to) &&
      (!accountId || tx.accountId === accountId || tx.destinationAccountId === accountId) &&
      (!categoryId || tx.categoryId === categoryId) &&
      (!type || tx.type === type) &&
      (!status || tx.status === status) &&
      (!term || `${tx.description} ${tx.notes}`.toLocaleLowerCase('pt-BR').includes(term)),
  );
}

export function totals(transactions) {
  return transactions.reduce(
    (result, tx) => {
      if (tx.status === 'pending') {
        result.pendingCents += tx.amountCents;
        result.pendingCount++;
        return result;
      }
      if (tx.type === 'income') result.income += tx.amountCents;
      if (tx.type === 'expense') result.expense += tx.amountCents;
      result.net = result.income - result.expense;
      return result;
    },
    { income: 0, expense: 0, net: 0, pendingCount: 0, pendingCents: 0 },
  );
}

export function accountBalance(account, transactions) {
  return transactions.reduce((balance, tx) => {
    if (tx.status !== 'confirmed') return balance;
    if (tx.accountId === account.id)
      balance += tx.type === 'income' ? tx.amountCents : -tx.amountCents;
    if (tx.type === 'transfer' && tx.destinationAccountId === account.id) balance += tx.amountCents;
    return balance;
  }, account.initialBalanceCents);
}

export const totalBalance = (accounts, transactions) =>
  accounts.reduce((sum, account) => sum + accountBalance(account, transactions), 0);
export const percentChange = (now, before) =>
  before === 0 ? (now === 0 ? 0 : null) : ((now - before) / Math.abs(before)) * 100;
export const percentage = (part, whole) => (whole ? (part / whole) * 100 : 0);
export function categoryTotals(transactions, categories) {
  return categories
    .filter((cat) => cat.type === 'expense')
    .map((cat) => ({
      ...cat,
      value: transactions
        .filter(
          (tx) => tx.status === 'confirmed' && tx.type === 'expense' && tx.categoryId === cat.id,
        )
        .reduce((sum, tx) => sum + tx.amountCents, 0),
    }))
    .filter((cat) => cat.value > 0)
    .sort((a, b) => b.value - a.value);
}
export function budgetProgress(budget, transactions) {
  const spent = totals(
    filterTransactions(transactions, {
      month: budget.month,
      categoryId: budget.categoryId,
      type: 'expense',
    }),
  ).expense;
  return {
    ...budget,
    spent,
    remaining: budget.limitCents - spent,
    percent: percentage(spent, budget.limitCents),
  };
}
export function monthlySeries(transactions, endMonth, count = 6, filters = {}) {
  return Array.from({ length: count }, (_, index) => {
    const month = shiftMonth(endMonth, index - count + 1);
    return {
      month,
      label: format(parseISO(`${month}-01`), 'MMM', { locale: ptBR }).replace('.', ''),
      ...totals(filterTransactions(transactions, { ...filters, month })),
    };
  });
}
export function recurringExpenses(transactions) {
  const groups = new Map();
  for (const tx of transactions.filter(
    (tx) => tx.type === 'expense' && tx.status === 'confirmed',
  )) {
    const key = `${tx.description.trim().toLocaleLowerCase('pt-BR')}|${tx.categoryId}|${tx.accountId}`;
    const group = groups.get(key) ?? { description: tx.description, months: new Set(), values: [] };
    group.months.add(tx.date.slice(0, 7));
    group.values.push(tx.amountCents);
    groups.set(key, group);
  }
  return [...groups.values()]
    .filter((group) => group.months.size >= 3)
    .map((group) => ({
      description: group.description,
      months: group.months.size,
      average: Math.round(group.values.reduce((a, b) => a + b, 0) / group.values.length),
    }))
    .sort((a, b) => b.average - a.average);
}

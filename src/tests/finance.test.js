import { describe, expect, it } from 'vitest';
import {
  accountBalance,
  totalBalance,
  totals,
  filterTransactions,
  budgetProgress,
  percentChange,
  parseMoney,
  shortDate,
  shiftMonth,
  monthlySeries,
  recurringExpenses,
  money,
} from '../domain/finance';
import { createDemoData } from '../services/demo';
import { transactionFormSchema, validateDataset } from '../domain/schemas';
import { transactionsCsv } from '../services/files';

const accounts = [
  { id: 'a', initialBalanceCents: 10000 },
  { id: 'b', initialBalanceCents: 5000 },
];
const tx = (values) => ({
  id: 't',
  description: 'Exemplo',
  type: 'expense',
  amountCents: 1000,
  categoryId: 'food',
  accountId: 'a',
  destinationAccountId: null,
  date: '2026-11-05',
  status: 'confirmed',
  notes: '',
  ...values,
});
describe('regras financeiras em centavos', () => {
  it.each([
    ['2026-01', -1, '2025-12'],
    ['2026-12', 1, '2027-01'],
  ])('mantém a virada de ano ao deslocar %s', (month, delta, expected) => {
    expect(shiftMonth(month, delta)).toBe(expected);
  });
  it('calcula o saldo total a partir de receitas e despesas confirmadas', () => {
    const rows = [tx({ type: 'income', amountCents: 7000 }), tx({ amountCents: 2500 })];
    expect(totalBalance(accounts, rows)).toBe(19500);
    expect(totals(rows)).toMatchObject({ income: 7000, expense: 2500, net: 4500 });
  });
  it('transfere entre contas sem alterar patrimônio nem receitas e despesas', () => {
    const rows = [
      tx({ type: 'transfer', categoryId: null, destinationAccountId: 'b', amountCents: 3000 }),
    ];
    expect(accountBalance(accounts[0], rows)).toBe(7000);
    expect(accountBalance(accounts[1], rows)).toBe(8000);
    expect(totalBalance(accounts, rows)).toBe(15000);
    expect(totals(rows)).toMatchObject({ income: 0, expense: 0, net: 0 });
  });
  it('exclui pendentes de saldo e orçamento e soma seu valor separadamente', () => {
    const rows = [
      tx({ status: 'pending' }),
      tx({ status: 'pending', type: 'transfer', categoryId: null, destinationAccountId: 'b' }),
    ];
    expect(totalBalance(accounts, rows)).toBe(15000);
    expect(totals(rows)).toMatchObject({ pendingCount: 2, pendingCents: 2000, expense: 0 });
    expect(
      budgetProgress({ month: '2026-11', categoryId: 'food', limitCents: 5000 }, rows).spent,
    ).toBe(0);
  });
  it('combina filtros de período, categoria, conta, tipo e texto', () => {
    const rows = [
      tx({ id: '1' }),
      tx({ id: '2', date: '2026-10-05' }),
      tx({ id: '3', accountId: 'b' }),
    ];
    expect(
      filterTransactions(rows, {
        month: '2026-11',
        accountId: 'a',
        categoryId: 'food',
        type: 'expense',
        search: 'EXEMPLO',
        from: '2026-11-01',
        to: '2026-11-30',
      }).map((row) => row.id),
    ).toEqual(['1']);
  });
  it('encontra transferências pela conta de destino', () => {
    expect(
      filterTransactions([tx({ type: 'transfer', destinationAccountId: 'b' })], { accountId: 'b' }),
    ).toHaveLength(1);
  });
  it('calcula limite, consumo e excedente do orçamento', () => {
    expect(
      budgetProgress({ month: '2026-11', categoryId: 'food', limitCents: 800 }, [tx({})]),
    ).toMatchObject({ spent: 1000, remaining: -200, percent: 125 });
  });
  it('trata comparações percentuais com base zero', () => {
    expect(percentChange(0, 0)).toBe(0);
    expect(percentChange(100, 0)).toBeNull();
    expect(percentChange(120, 100)).toBe(20);
    expect(percentChange(-50, -100)).toBe(50);
  });
  it.each([
    ['0,01', 1],
    ['1.234,56', 123456],
    ['12.30', 1230],
    ['-25,50', -2550],
    ['R$ 10,20', 1020],
    ['0.10', 10],
  ])('converte %s sem erro de ponto flutuante', (input, expected) =>
    expect(parseMoney(input)).toBe(expected),
  );
  it.each(['1,234', '1.234', 'NaN', '', '1,2,3', '1e4', '10000000000000'])(
    'rejeita valor inválido %s',
    (value) => expect(() => parseMoney(value)).toThrow(),
  );
  it('não desloca datas por fuso horário', () => {
    expect(shortDate('2026-11-01')).toBe('01 nov');
    expect(money(1)).toContain('0,01');
  });
  it('gera seis meses e aplica o filtro de conta em cada período', () => {
    const series = monthlySeries(
      [tx({}), tx({ accountId: 'b', amountCents: 5000 })],
      '2026-11',
      6,
      { accountId: 'a' },
    );
    expect(series).toHaveLength(6);
    expect(series.at(-1)).toMatchObject({ month: '2026-11', expense: 1000 });
    expect(series[0].month).toBe('2026-06');
  });
  it('identifica recorrência apenas em meses distintos suficientes', () => {
    const rows = ['09', '10', '11'].map((month) => tx({ date: `2026-${month}-05` }));
    expect(recurringExpenses(rows)[0]).toMatchObject({ months: 3, average: 1000 });
    expect(recurringExpenses([tx({}), tx({}), tx({})])).toEqual([]);
  });
  it('valida todos os vínculos dos dados demonstrativos', () =>
    expect(validateDataset(createDemoData('2026-11')).transactions).toHaveLength(90));
  it.each([
    ['  =1+1', '  =1+1'],
    ['\n=2+2', '\n=2+2'],
    ['\t@SUM(1)', '\t@SUM(1)'],
    ['\u200b+1', '\u200b+1'],
    ['  -1+2', '  -1+2'],
    ['  ＝1+1', '  ＝1+1'],
    ['＋SUM(1)', '＋SUM(1)'],
    ['－1+2', '－1+2'],
    ['＠SUM(1)', '＠SUM(1)'],
  ])('neutraliza fórmulas CSV com prefixos invisíveis: %j', (input, expected) => {
    const csv = transactionsCsv([tx({ description: input })], [], []);
    expect(csv).toContain(`"'${expected}"`);
  });
  it('preserva texto normal, separadores, quebras e números na exportação CSV', () => {
    const csv = transactionsCsv(
      [tx({ description: 'Almoço; café', notes: 'linha 1\nlinha 2' })],
      [],
      [],
    );
    expect(csv).toContain('"Almoço; café"');
    expect(csv).toContain('"linha 1\nlinha 2"');
    expect(csv).toContain('"10,00"');
    expect(csv.startsWith('\ufeff')).toBe(true);
  });
  it('protege a exportação CSV contra fórmulas e escapa aspas', () => {
    const csv = transactionsCsv([tx({ description: '=SUM("A1")' })], [], []);
    expect(csv).toContain("'=");
    expect(csv).toContain('""A1""');
    expect(csv.startsWith('\ufeff')).toBe(true);
  });
});
describe('validações de formulário', () => {
  const valid = {
    description: 'Compra',
    type: 'expense',
    amount: '10,00',
    categoryId: 'food',
    accountId: 'a',
    destinationAccountId: '',
    date: '2026-11-11',
    status: 'confirmed',
    notes: '',
  };
  it('aceita valores positivos e dados completos', () =>
    expect(transactionFormSchema.safeParse(valid).success).toBe(true));
  it.each([
    ['2024-02-29', true],
    ['2025-02-29', false],
    ['2026-04-31', false],
    ['2026-12-31', true],
  ])('valida a data civil %s', (date, expected) => {
    expect(transactionFormSchema.safeParse({ ...valid, date }).success).toBe(expected);
  });
  it.each([
    { amount: '0' },
    { amount: '-1' },
    { description: '' },
    { date: '2026-02-30' },
    { categoryId: '' },
    { accountId: '' },
    { type: 'transfer', destinationAccountId: 'a' },
  ])('rejeita formulário inválido %j', (invalid) =>
    expect(transactionFormSchema.safeParse({ ...valid, ...invalid }).success).toBe(false),
  );
});

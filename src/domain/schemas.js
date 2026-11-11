import { z } from 'zod';
import { isValid, parseISO, format } from 'date-fns';
import { parseMoney } from './finance';

const id = z.string().min(1).max(120);
const name = z
  .string()
  .trim()
  .min(2, 'Informe pelo menos 2 caracteres.')
  .max(100, 'Use até 100 caracteres.');
const date = z
  .string()
  .refine(
    (value) =>
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      isValid(parseISO(value)) &&
      format(parseISO(value), 'yyyy-MM-dd') === value,
    'Informe uma data válida.',
  );
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Informe um mês válido.');
const cents = z.number().int().min(1).max(100_000_000_000);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const icons = [
  'wallet',
  'bank',
  'credit',
  'food',
  'home',
  'car',
  'book',
  'heart',
  'coffee',
  'shopping',
  'briefcase',
  'chart',
  'tag',
];
export const accountSchema = z.object({
  id,
  name,
  type: z.enum(['checking', 'digital', 'savings', 'cash']),
  initialBalanceCents: z.number().int().min(-100_000_000_000).max(100_000_000_000),
  color,
  icon: z.enum(icons),
  createdAt: date,
});
export const categorySchema = z.object({
  id,
  name,
  type: z.enum(['income', 'expense']),
  color,
  icon: z.enum(icons),
});
export const transactionSchema = z.object({
  id,
  description: name,
  type: z.enum(['income', 'expense', 'transfer']),
  amountCents: cents,
  categoryId: id.nullable(),
  accountId: id,
  destinationAccountId: id.nullable(),
  date,
  status: z.enum(['confirmed', 'pending']),
  notes: z.string().max(1000),
});
export const budgetSchema = z.object({ id, categoryId: id, month, limitCents: cents });

export const datasetSchema = z
  .object({
    version: z.literal(1),
    accounts: z.array(accountSchema).max(10000),
    categories: z.array(categorySchema).max(10000),
    transactions: z.array(transactionSchema).max(100000),
    budgets: z.array(budgetSchema).max(10000),
  })
  .superRefine((data, ctx) => {
    const error = (message) => ctx.addIssue({ code: 'custom', message });
    for (const entity of ['accounts', 'categories', 'transactions', 'budgets'])
      if (new Set(data[entity].map((row) => row.id)).size !== data[entity].length)
        error(`Há identificadores duplicados em ${entity}.`);
    const accountIds = new Set(data.accounts.map((row) => row.id));
    const categories = new Map(data.categories.map((row) => [row.id, row]));
    for (const tx of data.transactions) {
      if (!accountIds.has(tx.accountId)) error('A conta de origem não existe.');
      if (tx.type === 'transfer') {
        if (!tx.destinationAccountId || !accountIds.has(tx.destinationAccountId))
          error('Selecione uma conta de destino válida.');
        if (tx.accountId === tx.destinationAccountId)
          error('As contas da transferência devem ser diferentes.');
        if (tx.categoryId !== null) error('Transferências não utilizam categoria.');
      } else {
        if (categories.get(tx.categoryId)?.type !== tx.type)
          error('A categoria deve ser compatível com o tipo da transação.');
        if (tx.destinationAccountId !== null)
          error('Somente transferências utilizam conta de destino.');
      }
    }
    const budgetKeys = new Set();
    for (const budget of data.budgets) {
      if (categories.get(budget.categoryId)?.type !== 'expense')
        error('O orçamento precisa de uma categoria de despesa.');
      const key = `${budget.month}|${budget.categoryId}`;
      if (budgetKeys.has(key)) error('Já existe um orçamento para essa categoria e mês.');
      budgetKeys.add(key);
    }
    const balanceBound =
      data.accounts.reduce((sum, row) => sum + Math.abs(row.initialBalanceCents), 0) +
      data.transactions.reduce((sum, row) => sum + row.amountCents, 0);
    if (!Number.isSafeInteger(balanceBound)) error('O total excede o limite de cálculo seguro.');
  });

const moneyText = (positive = true) =>
  z
    .string()
    .min(1, 'Informe o valor.')
    .superRefine((value, ctx) => {
      try {
        if (positive && parseMoney(value) <= 0)
          ctx.addIssue({ code: 'custom', message: 'O valor deve ser maior que zero.' });
      } catch (error) {
        ctx.addIssue({ code: 'custom', message: error.message });
      }
    });
export const transactionFormSchema = z
  .object({
    description: name,
    type: z.enum(['income', 'expense', 'transfer']),
    amount: moneyText(),
    categoryId: z.string(),
    accountId: z.string().min(1, 'Selecione uma conta.'),
    destinationAccountId: z.string(),
    date,
    status: z.enum(['confirmed', 'pending']),
    notes: z.string().max(1000, 'Use até 1.000 caracteres.'),
  })
  .superRefine((value, ctx) => {
    if (value.type === 'transfer') {
      if (!value.destinationAccountId)
        ctx.addIssue({
          code: 'custom',
          path: ['destinationAccountId'],
          message: 'Selecione a conta de destino.',
        });
      else if (value.accountId === value.destinationAccountId)
        ctx.addIssue({
          code: 'custom',
          path: ['destinationAccountId'],
          message: 'Escolha uma conta diferente da origem.',
        });
    } else if (!value.categoryId)
      ctx.addIssue({ code: 'custom', path: ['categoryId'], message: 'Selecione uma categoria.' });
  });
export const accountFormSchema = z.object({
  name,
  type: accountSchema.shape.type,
  initialBalance: moneyText(false),
  color,
  icon: z.enum(icons),
});
export const categoryFormSchema = categorySchema.omit({ id: true });
export const budgetFormSchema = z.object({
  categoryId: z.string().min(1, 'Selecione uma categoria.'),
  month,
  limit: moneyText(),
});

export function validateDataset(data) {
  const result = datasetSchema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(
      issue?.code === 'custom'
        ? issue.message
        : 'Os dados contêm campos ausentes ou inválidos. Verifique o formato do backup (versão 1).',
    );
  }
  return result.data;
}

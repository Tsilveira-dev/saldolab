import { randomUUID } from 'node:crypto';
import { ApiError } from './errors.js';

export const entities = {
  accounts: {
    fields: {
      name: 'name',
      type: 'type',
      initialBalanceCents: 'initial_balance_cents',
      color: 'color',
      icon: 'icon',
      createdAt: 'created_at',
    },
  },
  categories: { fields: { name: 'name', type: 'type', color: 'color', icon: 'icon' } },
  transactions: {
    fields: {
      description: 'description',
      type: 'type',
      amountCents: 'amount_cents',
      categoryId: 'category_id',
      accountId: 'account_id',
      destinationAccountId: 'destination_account_id',
      date: 'date',
      status: 'status',
      notes: 'notes',
    },
  },
  budgets: { fields: { categoryId: 'category_id', month: 'month', limitCents: 'limit_cents' } },
};
const icons = new Set([
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
]);
const types = {
  accounts: new Set(['checking', 'digital', 'savings', 'cash']),
  categories: new Set(['income', 'expense']),
  transactions: new Set(['income', 'expense', 'transfer']),
};
const validDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00Z');
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
};
const validMonth = (value) => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
const string = (value, min, max) =>
  typeof value === 'string' &&
  value.trim().length >= min &&
  value.trim().length <= max &&
  value.length <= max;
const int = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const color = (value) => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
const id = (value) => typeof value === 'string' && value.length >= 1 && value.length <= 120;
const text = (value, max) => typeof value === 'string' && value.length <= max;

export function assertEntity(entity) {
  if (!Object.hasOwn(entities, entity)) throw new ApiError(404, 'Recurso não encontrado.');
  return entities[entity];
}
export function validateWrite(entity, value, { create = false } = {}) {
  const spec = assertEntity(entity);
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ApiError(422, 'Informe os campos do registro.');
  const keys = Object.keys(value);
  if (keys.length === 0 || keys.some((key) => !Object.hasOwn(spec.fields, key)))
    throw new ApiError(422, 'Campos ausentes ou não permitidos.');
  if (create && keys.length !== Object.keys(spec.fields).length)
    throw new ApiError(422, 'O cadastro precisa de todos os campos.');

  const fail = () => {
    throw new ApiError(422, 'Há campos financeiros inválidos.');
  };
  for (const [key, field] of Object.entries(value)) {
    let okay;
    if (key === 'name' || key === 'description') okay = string(field, 2, 100);
    else if (key === 'type') okay = types[entity]?.has(field);
    else if (key === 'color') okay = color(field);
    else if (key === 'icon') okay = icons.has(field);
    else if (key === 'initialBalanceCents') okay = int(field, -100000000000, 100000000000);
    else if (key === 'amountCents' || key === 'limitCents') okay = int(field, 1, 100000000000);
    else if (key === 'createdAt' || key === 'date') okay = validDate(field);
    else if (key === 'month') okay = validMonth(field);
    else if (key === 'status') okay = field === 'confirmed' || field === 'pending';
    else if (key === 'notes') okay = text(field, 1000);
    else if (key === 'destinationAccountId' || key === 'categoryId')
      okay = field === null || id(field);
    else if (key === 'accountId') okay = id(field);
    if (!okay) fail();
  }
  return value;
}
export function validateWholeRecord(entity, row) {
  const all = Object.fromEntries(
    Object.keys(entities[entity].fields).map((key) => [key, row[key]]),
  );
  validateWrite(entity, all, { create: true });
  if (entity === 'transactions') {
    if (all.type === 'transfer') {
      if (
        all.categoryId !== null ||
        all.destinationAccountId === null ||
        all.accountId === all.destinationAccountId
      ) {
        throw new ApiError(422, 'Transferências exigem duas contas distintas e não têm categoria.');
      }
    } else if (all.categoryId === null || all.destinationAccountId !== null) {
      throw new ApiError(422, 'Receitas e despesas exigem categoria, sem conta de destino.');
    }
  } else if (entity === 'budgets' && !id(all.categoryId)) {
    throw new ApiError(422, 'Informe uma categoria de orçamento.');
  }
  return all;
}
export function newRecordId() {
  return randomUUID();
}
export function serializeRow(entity, row) {
  const data = { id: row.id };
  for (const [key, col] of Object.entries(entities[entity].fields)) {
    const value = row[col];
    data[key] = ['initialBalanceCents', 'amountCents', 'limitCents'].includes(key)
      ? Number(value)
      : value;
  }
  return { ...data, revision: Number(row.revision) };
}
export function validateId(value) {
  if (!id(value)) throw new ApiError(422, 'Identificador inválido.');
  return value;
}
export function validateRevision(value) {
  if (!int(value, 1, 2147483647)) throw new ApiError(409, 'Atualize a página antes de editar.');
  return value;
}

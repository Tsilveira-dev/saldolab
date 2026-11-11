import { validateDataset } from '../domain/schemas';
import { createDemoData, emptyDataset, newId } from '../services/demo';

export class StorageError extends Error {
  constructor(message, raw = null) {
    super(message);
    this.name = 'StorageError';
    this.raw = raw;
  }
}
export const STORAGE_VERSION = 1;
export const storageKey = (mode) => `saldolab:v${STORAGE_VERSION}:${mode}`;
const entities = ['accounts', 'categories', 'transactions', 'budgets'];

export function createLocalRepository({ mode = 'demo', storage, seed = createDemoData } = {}) {
  if (!['demo', 'personal'].includes(mode)) throw new Error('Modo inválido.');
  const key = storageKey(mode);
  const read = () => {
    let raw;
    try {
      raw = (storage ?? window.localStorage).getItem(key);
    } catch {
      throw new StorageError(
        'O navegador bloqueou o armazenamento. Ative o armazenamento local para continuar.',
      );
    }
    if (raw === null) {
      const data = validateDataset(mode === 'demo' ? seed() : emptyDataset());
      write(data);
      return data;
    }
    try {
      return validateDataset(JSON.parse(raw));
    } catch {
      throw new StorageError(
        'Os dados locais estão corrompidos ou usam uma versão incompatível. Exporte o conteúdo original antes de restaurar ou importe um backup válido.',
        raw,
      );
    }
  };
  const write = (data) => {
    const validated = validateDataset(data);
    try {
      (storage ?? window.localStorage).setItem(key, JSON.stringify(validated));
    } catch {
      throw new StorageError(
        'Não foi possível salvar. O armazenamento pode estar cheio ou bloqueado. Seus dados anteriores foram preservados.',
      );
    }
    return structuredClone(validated);
  };
  const checkEntity = (entity) => {
    if (!entities.includes(entity)) throw new Error('Repositório inválido.');
  };
  return {
    mode,
    async snapshot() {
      return structuredClone(read());
    },
    async list(entity) {
      checkEntity(entity);
      return structuredClone(read()[entity]);
    },
    async getById(entity, id) {
      checkEntity(entity);
      return structuredClone(read()[entity].find((row) => row.id === id) ?? null);
    },
    async create(entity, values) {
      checkEntity(entity);
      const data = read();
      const row = { ...values, id: values.id || newId() };
      data[entity].push(row);
      write(data);
      return structuredClone(row);
    },
    async update(entity, id, values) {
      checkEntity(entity);
      const data = read();
      const index = data[entity].findIndex((row) => row.id === id);
      if (index < 0) throw new Error('Registro não encontrado. Recarregue os dados.');
      const row = { ...data[entity][index], ...values, id };
      data[entity][index] = row;
      write(data);
      return structuredClone(row);
    },
    async remove(entity, id) {
      checkEntity(entity);
      const data = read();
      if (!data[entity].some((row) => row.id === id)) throw new Error('Registro não encontrado.');
      if (
        entity === 'accounts' &&
        data.transactions.some((tx) => tx.accountId === id || tx.destinationAccountId === id)
      )
        throw new Error(
          'Esta conta possui movimentações. Transfira ou remova os registros associados antes de excluí-la.',
        );
      if (
        entity === 'categories' &&
        (data.transactions.some((tx) => tx.categoryId === id) ||
          data.budgets.some((budget) => budget.categoryId === id))
      )
        throw new Error(
          'Esta categoria está em uso por transações ou orçamentos e não pode ser excluída.',
        );
      data[entity] = data[entity].filter((row) => row.id !== id);
      write(data);
    },
    async exportBackup() {
      return JSON.stringify(
        { app: 'SaldoLab', exportedAt: new Date().toISOString(), data: read() },
        null,
        2,
      );
    },
    async importBackup(text) {
      const data = parseBackup(text);
      write(data);
      return structuredClone(data);
    },
    async reset() {
      return write(mode === 'demo' ? seed() : emptyDataset());
    },
  };
}

export function parseBackup(text) {
  if (typeof text !== 'string' || text.length > 20_000_000)
    throw new Error('O backup deve ter no máximo 20 MB.');
  let backup;
  try {
    backup = JSON.parse(text);
  } catch {
    throw new Error('O arquivo não contém um JSON válido.');
  }
  if (!backup || typeof backup !== 'object' || backup.app !== 'SaldoLab')
    throw new Error('Selecione um backup do SaldoLab.');
  return validateDataset(backup.data);
}

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
// Separate tabs can cache localStorage snapshots even while operation locks are held.
// Keep one writer per document/mode so an acknowledged save cannot be overwritten by that cache.
const editorLeases = new WeakMap();

function getEditorLease(lockManager, key) {
  let leases = editorLeases.get(lockManager);
  if (!leases) {
    leases = new Map();
    editorLeases.set(lockManager, leases);
  }
  if (leases.has(key)) return leases.get(key).ready;
  const lease = { owned: false };
  lease.ready = new Promise((resolve, reject) => {
    lockManager
      .request(`${key}:editor`, { ifAvailable: true }, (lock) => {
        lease.owned = Boolean(lock);
        resolve(lease);
        if (!lock) return;
        return new Promise((release) => {
          globalThis.addEventListener?.(
            'pagehide',
            () => {
              lease.owned = false;
              release();
            },
            { once: true },
          );
        });
      })
      .catch(reject);
  });
  leases.set(key, lease);
  return lease.ready;
}

export function createLocalRepository({
  mode = 'demo',
  storage,
  seed = createDemoData,
  lockManager = globalThis.navigator?.locks,
} = {}) {
  if (!['demo', 'personal'].includes(mode)) throw new Error('Modo inválido.');
  const key = storageKey(mode);
  let editorLease;
  const withLock = async (operation) => {
    if (!lockManager?.request) return operation();
    try {
      editorLease = await getEditorLease(lockManager, key);
      return await lockManager.request(`${key}:operation`, operation);
    } catch (error) {
      if (error.name === 'SecurityError' || error.name === 'NotSupportedError') {
        throw new StorageError(
          'O navegador bloqueou o acesso seguro aos dados. Permita o armazenamento local e use HTTPS ou localhost.',
        );
      }
      throw error;
    }
  };
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
    if (!lockManager?.request) {
      throw new StorageError(
        'Este navegador não oferece edição segura entre abas. Use um navegador atualizado em HTTPS ou localhost. Os dados existentes continuam disponíveis para leitura e backup.',
      );
    }
    if (!editorLease?.owned) {
      throw new StorageError(
        'A edição segura está reservada a outra aba ou à sessão anterior. Feche a aba editora e recarregue esta página para editar. Os dados foram preservados.',
      );
    }
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
  const checkExpected = (current, expected) => {
    if (expected !== undefined && JSON.stringify(current) !== JSON.stringify(expected)) {
      throw new Error(
        'Este registro foi alterado em outra aba. Feche a janela e confira os dados atualizados antes de tentar novamente.',
      );
    }
  };
  return {
    mode,
    async snapshot() {
      return withLock(() => structuredClone(read()));
    },
    async list(entity) {
      checkEntity(entity);
      return withLock(() => structuredClone(read()[entity]));
    },
    async getById(entity, id) {
      checkEntity(entity);
      return withLock(() => structuredClone(read()[entity].find((row) => row.id === id) ?? null));
    },
    async create(entity, values) {
      checkEntity(entity);
      return withLock(() => {
        const data = read();
        const row = { ...values, id: values.id || newId() };
        data[entity].push(row);
        return write(data)[entity].find((saved) => saved.id === row.id);
      });
    },
    async update(entity, id, values, { expected } = {}) {
      checkEntity(entity);
      return withLock(() => {
        const data = read();
        const index = data[entity].findIndex((row) => row.id === id);
        if (index < 0) throw new Error('Registro não encontrado. Recarregue os dados.');
        checkExpected(data[entity][index], expected);
        data[entity][index] = { ...data[entity][index], ...values, id };
        return write(data)[entity].find((saved) => saved.id === id);
      });
    },
    async remove(entity, id, { expected } = {}) {
      checkEntity(entity);
      return withLock(() => {
        const data = read();
        const current = data[entity].find((row) => row.id === id);
        if (!current) throw new Error('Registro não encontrado.');
        checkExpected(current, expected);
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
      });
    },
    async exportBackup() {
      return withLock(() =>
        JSON.stringify(
          { app: 'SaldoLab', exportedAt: new Date().toISOString(), data: read() },
          null,
          2,
        ),
      );
    },
    async importBackup(text) {
      const data = parseBackup(text);
      return withLock(() => write(data));
    },
    async reset() {
      return withLock(() => write(mode === 'demo' ? seed() : emptyDataset()));
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

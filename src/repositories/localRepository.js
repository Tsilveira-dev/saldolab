import { validateDataset } from '../domain/schemas';
import { createDemoData, emptyDataset, newId } from '../services/demo';
import { getEditingSession } from './editingSession';

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
export function createLocalRepository({
  mode = 'demo',
  storage,
  seed = createDemoData,
  lockManager = globalThis.navigator?.locks,
} = {}) {
  if (!['demo', 'personal'].includes(mode)) throw new Error('Modo inválido.');
  const key = storageKey(mode);
  const session = getEditingSession(key, lockManager);
  let initialData;
  const assertWritable = () => {
    const access = session.getAccess();
    if (access.canWrite) return;
    throw new StorageError(
      !access.supported
        ? 'Este navegador não oferece edição segura entre abas. Use um navegador atualizado em HTTPS ou localhost. Os dados existentes continuam disponíveis para leitura e backup.'
        : access.reason === 'blocked'
          ? 'O navegador bloqueou a edição segura. Confira as permissões de armazenamento.'
          : access.reason === 'other-tab'
            ? 'A edição está reservada a outra aba. Encerre a edição nela e ative a edição nesta aba. Os dados foram preservados.'
            : 'Esta aba está em modo somente leitura. Ative a edição para salvar alterações. A página será recarregada para conferir os dados atuais.',
    );
  };
  const withWriteLock = async (operation) => {
    assertWritable();
    try {
      return await lockManager.request(`${key}:operation`, () => {
        assertWritable();
        return operation();
      });
    } catch (error) {
      if (error.name === 'SecurityError' || error.name === 'NotSupportedError') {
        await session.stop();
        throw new StorageError(
          'O navegador bloqueou a edição segura. Recarregue a página e confira as permissões de armazenamento.',
        );
      }
      throw error;
    }
  };
  const read = () => {
    session.noteRead();
    let raw;
    try {
      raw = (storage ?? window.localStorage).getItem(key);
    } catch {
      throw new StorageError(
        'O navegador bloqueou o armazenamento. Ative o armazenamento local para continuar.',
      );
    }
    if (raw === null) {
      initialData ??= validateDataset(mode === 'demo' ? seed() : emptyDataset());
      return structuredClone(initialData);
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
    assertWritable();
    const validated = validateDataset(data);
    const serialized = JSON.stringify(validated);
    try {
      (storage ?? window.localStorage).setItem(key, serialized);
    } catch {
      throw new StorageError(
        'Não foi possível salvar. O armazenamento pode estar cheio ou bloqueado. Seus dados anteriores foram preservados.',
      );
    }
    try {
      if ((storage ?? window.localStorage).getItem(key) !== serialized)
        throw new Error('Unconfirmed write');
    } catch {
      throw new StorageError(
        'Não foi possível confirmar a gravação. Os dados podem ter sido salvos; recarregue e confira antes de tentar novamente.',
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
    getEditingAccess: session.getAccess,
    subscribeEditing: session.subscribe,
    startEditing: session.start,
    stopEditing: session.stop,
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
      return withWriteLock(() => {
        const data = read();
        const row = { ...values, id: values.id || newId() };
        data[entity].push(row);
        return write(data)[entity].find((saved) => saved.id === row.id);
      });
    },
    async update(entity, id, values, { expected } = {}) {
      checkEntity(entity);
      return withWriteLock(() => {
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
      return withWriteLock(() => {
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
      return JSON.stringify(
        { app: 'SaldoLab', exportedAt: new Date().toISOString(), data: read() },
        null,
        2,
      );
    },
    async importBackup(text) {
      const data = parseBackup(text);
      return withWriteLock(() => write(data));
    },
    async reset() {
      return withWriteLock(() => write(mode === 'demo' ? seed() : emptyDataset()));
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

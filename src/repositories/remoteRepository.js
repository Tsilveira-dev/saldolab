import { getAuthToken } from '../auth/neonClient';
import { validateDataset } from '../domain/schemas';

const entities = new Set(['accounts', 'categories', 'transactions', 'budgets']);
const checkEntity = (entity) => {
  if (!entities.has(entity)) throw new Error('Recurso financeiro desconhecido.');
};
async function apiCall(entity, { method = 'GET', id, body } = {}) {
  if (entity) checkEntity(entity);
  const params = new URLSearchParams();
  if (entity) params.set('entity', entity);
  if (id) params.set('id', id);
  const url = '/api/finance' + (params.size ? '?' + params.toString() : '');
  const token = await getAuthToken();
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: 'Bearer ' + token,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store',
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error('Não foi possível receber a resposta do servidor.');
  }
  if (!response.ok) throw new Error(result.error ?? 'Não foi possível concluir a operação.');
  return result;
}
export function createRemoteRepository() {
  const editing = { canWrite: true, supported: true, reason: 'cloud' };
  return {
    mode: 'cloud',
    getEditingAccess: () => editing,
    subscribeEditing: () => () => {},
    startEditing: async () => true,
    stopEditing: async () => {},
    snapshot: () => apiCall(),
    list: (entity) => apiCall(entity),
    getById: (entity, id) => apiCall(entity, { id }),
    create: (entity, values) => apiCall(entity, { method: 'POST', body: values }),
    update: (entity, id, values, { expected } = {}) =>
      apiCall(entity, {
        method: 'PATCH',
        id,
        body: { ...values, expectedRevision: expected?.revision },
      }),
    remove: (entity, id, { expected } = {}) =>
      apiCall(entity, {
        method: 'DELETE',
        id,
        body: { expectedRevision: expected?.revision },
      }),
    exportBackup: async () => {
      const snap = await apiCall();
      const clean = Object.fromEntries(
        [...entities].map((key) => [key, snap[key].map(({ revision: _revision, ...row }) => row)]),
      );
      const data = validateDataset({ version: 1, ...clean });
      return JSON.stringify(
        { app: 'SaldoLab', exportedAt: new Date().toISOString(), data },
        null,
        2,
      );
    },
    importBackup: async () => {
      throw new Error(
        'Importação para a nuvem requer prévia e confirmação. Use o modo pessoal para restaurar backups locais.',
      );
    },
    reset: async () => {
      throw new Error('Limpeza de dados remotos está desabilitada por segurança.');
    },
  };
}

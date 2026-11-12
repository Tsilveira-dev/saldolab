import { getAuthToken } from '../auth/neonClient';
import { exportCloudBackup } from './cloudBackup.js';

const entities = new Set(['accounts', 'categories', 'transactions', 'budgets']);
const checkEntity = (entity) => {
  if (!entities.has(entity)) throw new Error('Recurso financeiro desconhecido.');
};
export class RemoteApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'RemoteApiError';
    this.status = status;
  }
}
async function apiCall(entity, { method = 'GET', id, body, userId } = {}) {
  if (entity) checkEntity(entity);
  const params = new URLSearchParams();
  if (entity) params.set('entity', entity);
  if (id) params.set('id', id);
  const url = '/api/finance' + (params.size ? '?' + params.toString() : '');
  const token = await getAuthToken({ expectedUserId: userId });
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: 'Bearer ' + token,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store',
    });
  } catch {
    throw new RemoteApiError(
      'Não foi possível conectar ao servidor. Confira sua conexão e tente novamente.',
      0,
    );
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new RemoteApiError('Não foi possível receber a resposta do servidor.', response.status);
  }
  if (!response.ok)
    throw new RemoteApiError(
      result.error ?? 'Não foi possível concluir a operação.',
      response.status,
    );
  return result;
}
export function createRemoteRepository({ userId } = {}) {
  const call = (entity, options = {}) => apiCall(entity, { ...options, userId });
  const editing = { canWrite: true, supported: true, reason: 'cloud' };
  return {
    mode: 'cloud',
    getEditingAccess: () => editing,
    subscribeEditing: () => () => {},
    startEditing: async () => true,
    stopEditing: async () => {},
    snapshot: () => call(),
    list: (entity) => call(entity),
    getById: (entity, id) => call(entity, { id }),
    create: (entity, values) => call(entity, { method: 'POST', body: values }),
    update: (entity, id, values, { expected } = {}) =>
      call(entity, {
        method: 'PATCH',
        id,
        body: { ...values, expectedRevision: expected?.revision },
      }),
    remove: (entity, id, { expected } = {}) =>
      call(entity, {
        method: 'DELETE',
        id,
        body: { expectedRevision: expected?.revision },
      }),
    exportBackup: async () => {
      const snap = await call();
      return exportCloudBackup(snap);
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

import { validateDataset } from '../domain/schemas.js';

export const financialEntities = ['accounts', 'categories', 'transactions', 'budgets'];

export function exportCloudBackup(snapshot) {
  const clean = Object.fromEntries(
    financialEntities.map((entity) => [
      entity,
      snapshot[entity].map(({ revision: _revision, ...row }) => row),
    ]),
  );
  const data = validateDataset({ version: 1, ...clean });
  return JSON.stringify({ app: 'SaldoLab', exportedAt: new Date().toISOString(), data }, null, 2);
}

export function readCloudBackup(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).byteLength > 20_000_000)
    throw new Error('BACKUP_SIZE_INVALID');
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('BACKUP_JSON_INVALID');
  }
  if (parsed?.app !== 'SaldoLab') throw new Error('BACKUP_APP_INVALID');
  return validateDataset(parsed.data);
}

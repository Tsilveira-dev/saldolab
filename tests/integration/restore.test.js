import { beforeAll, afterAll, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createIntegrationHarness } from './harness.js';
import { exportCloudBackup } from '../../src/repositories/cloudBackup.js';
import { inspectBackup, restoreBackup } from '../../scripts/restore-cloud-backup.js';
import { snapshot } from '../../api/_lib/finance.js';
import { totalBalance } from '../../src/domain/finance.js';

let api;
const branchId = 'local-restore-integration';
const fixture = {
  version: 1,
  accounts: [
    {
      id: 'old-account',
      name: 'QA backup',
      type: 'checking',
      initialBalanceCents: 100000,
      color: '#123456',
      icon: 'bank',
      createdAt: '2026-11-12',
    },
  ],
  categories: [
    { id: 'old-category', name: 'QA despesa', type: 'expense', color: '#123456', icon: 'tag' },
  ],
  transactions: [
    {
      id: 'old-transaction',
      description: 'QA backup despesa',
      type: 'expense',
      amountCents: 12345,
      categoryId: 'old-category',
      accountId: 'old-account',
      destinationAccountId: null,
      date: '2026-11-12',
      status: 'confirmed',
      notes: '',
    },
  ],
  budgets: [{ id: 'old-budget', categoryId: 'old-category', month: '2026-11', limitCents: 50000 }],
};
const backup = () => exportCloudBackup(fixture);
async function identity() {
  const id = randomUUID();
  await api.pool.query('INSERT INTO neon_auth."user"(id) VALUES($1)', [id]);
  return id;
}
beforeAll(async () => {
  api = await createIntegrationHarness();
  // This fixture schema exists only in the isolated local service, never Neon.
  const url = new URL(process.env.SALDOLAB_TEST_DATABASE_URL);
  if (url.hostname !== '127.0.0.1' || url.pathname !== '/saldolab_integration')
    throw new Error('Local restore integration only');
  await api.pool.query(
    'CREATE SCHEMA IF NOT EXISTS saldolab_qa; CREATE TABLE IF NOT EXISTS saldolab_qa.environment(branch_id text PRIMARY KEY,purpose text NOT NULL,auth_base_url text); CREATE SCHEMA IF NOT EXISTS neon_auth; CREATE TABLE IF NOT EXISTS neon_auth."user"(id text PRIMARY KEY)',
  );
  await api.pool.query(
    "INSERT INTO saldolab_qa.environment(branch_id,purpose) VALUES($1,'isolated restore rehearsal') ON CONFLICT DO NOTHING",
    [branchId],
  );
});
afterAll(async () => await api?.close());
it('exporta o formato v1 sem revisões, credenciais ou identidade de autenticação', () => {
  const parsed = JSON.parse(
    exportCloudBackup({
      ...fixture,
      accounts: fixture.accounts.map((row) => ({ ...row, revision: 8 })),
    }),
  );
  expect(parsed.data).toEqual(fixture);
  expect(parsed.app).toBe('SaldoLab');
  expect(inspectBackup(JSON.stringify(parsed)).counts).toEqual({
    accounts: 1,
    categories: 1,
    transactions: 1,
    budgets: 1,
  });
});
it('restaura as quatro entidades no PostgreSQL real com novos IDs e centavos preservados', async () => {
  const userId = await identity();
  const result = await restoreBackup(api.pool, { text: backup(), branchId, userId });
  expect(result.status).toBe('restored');
  const restored = await snapshot(api.pool, userId);
  expect(totalBalance(restored.accounts, restored.transactions)).toBe(87655);
  expect(restored.transactions[0].accountId).toBe(restored.accounts[0].id);
  expect(restored.transactions[0].categoryId).toBe(restored.categories[0].id);
  expect(restored.accounts[0].id).not.toBe('old-account');
  expect(restored.budgets[0].limitCents).toBe(50000);
});
it('não sobrescreve destino com dados nem repete uma restauração', async () => {
  const userId = await identity();
  const options = { text: backup(), branchId, userId };
  await restoreBackup(api.pool, options);
  const before = await snapshot(api.pool, userId);
  await expect(restoreBackup(api.pool, options)).rejects.toThrow('RESTORE_TARGET_NOT_EMPTY');
  expect(await snapshot(api.pool, userId)).toEqual(before);
});
it('bloqueia branch incorreta antes de qualquer INSERT', async () => {
  const userId = await identity();
  await expect(
    restoreBackup(api.pool, { text: backup(), branchId: 'production', userId }),
  ).rejects.toThrow('RESTORE_QA_MARKER_REQUIRED');
  expect((await snapshot(api.pool, userId)).accounts).toEqual([]);
});
it('rejeita backup corrompido e identidade ausente, sem restauração parcial', async () => {
  const userId = await identity();
  await expect(restoreBackup(api.pool, { text: '{bad', branchId, userId })).rejects.toThrow(
    'BACKUP_JSON_INVALID',
  );
  await expect(
    restoreBackup(api.pool, { text: backup(), branchId, userId: randomUUID() }),
  ).rejects.toThrow('RESTORE_IDENTITY_REQUIRED');
  expect((await snapshot(api.pool, userId)).accounts).toEqual([]);
});
it('duas restaurações simultâneas não duplicam os dados', async () => {
  const userId = await identity();
  const options = { text: backup(), branchId, userId };
  const results = await Promise.allSettled([
    restoreBackup(api.pool, options),
    restoreBackup(api.pool, options),
  ]);
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  expect((await snapshot(api.pool, userId)).accounts).toHaveLength(1);
});

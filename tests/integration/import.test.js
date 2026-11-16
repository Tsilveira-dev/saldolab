import { beforeAll, afterAll, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createIntegrationHarness } from './harness.js';
import { exportCloudBackup } from '../../src/repositories/cloudBackup.js';
import { snapshot } from '../../api/_lib/finance.js';

let api;
let userId;
let credentials;
const fixture = {
  version: 1,
  accounts: [{
    id: 'legacy-account',
    name: 'Conta migrada',
    type: 'checking',
    initialBalanceCents: 125000,
    color: '#123456',
    icon: 'bank',
    createdAt: '2026-11-12',
  }],
  categories: [{
    id: 'legacy-category',
    name: 'Alimentação',
    type: 'expense',
    color: '#123456',
    icon: 'food',
  }],
  transactions: [{
    id: 'legacy-transaction',
    description: 'Compra migrada',
    type: 'expense',
    amountCents: 2599,
    categoryId: 'legacy-category',
    accountId: 'legacy-account',
    destinationAccountId: null,
    date: '2026-11-12',
    status: 'confirmed',
    notes: '',
  }],
  budgets: [{
    id: 'legacy-budget',
    categoryId: 'legacy-category',
    month: '2026-11',
    limitCents: 30000,
  }],
};
const backup = exportCloudBackup(fixture);

async function importRequest(body = { backup }, auth = credentials) {
  return fetch(api.origin + '/api/finance?operation=import', {
    method: 'POST',
    headers: {
      ...(auth?.token ? { Authorization: 'Bearer ' + auth.token } : {}),
      ...(auth?.sessionId ? { 'X-SaldoLab-Session-Id': auth.sessionId } : {}),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  api = await createIntegrationHarness();
  const url = new URL(process.env.SALDOLAB_TEST_DATABASE_URL);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.pathname !== '/saldolab_integration')
    throw new Error('Cloud import integration tests require the disposable local database.');
  await api.pool.query('CREATE SCHEMA IF NOT EXISTS neon_auth; CREATE TABLE IF NOT EXISTS neon_auth."user"(id text PRIMARY KEY)');
  userId = randomUUID();
  await api.pool.query('INSERT INTO neon_auth."user"(id) VALUES($1)', [userId]);
  credentials = await api.signToken(userId);
});

afterAll(async () => {
  await api?.close();
});

it('importa as quatro entidades, remapeia IDs e mantém todos os vínculos e valores', async () => {
  const response = await importRequest();
  expect(response.status).toBe(201);
  expect(await response.json()).toMatchObject({
    status: 'imported',
    counts: { accounts: 1, categories: 1, transactions: 1, budgets: 1 },
    idsRemapped: true,
  });
  const saved = await snapshot(api.pool, userId);
  expect(saved.accounts).toHaveLength(1);
  expect(saved.categories).toHaveLength(1);
  expect(saved.transactions).toHaveLength(1);
  expect(saved.budgets).toHaveLength(1);
  expect(saved.accounts[0].id).not.toBe('legacy-account');
  expect(saved.categories[0].id).not.toBe('legacy-category');
  expect(saved.transactions[0]).toMatchObject({
    amountCents: 2599,
    accountId: saved.accounts[0].id,
    categoryId: saved.categories[0].id,
  });
  expect(saved.budgets[0]).toMatchObject({
    categoryId: saved.categories[0].id,
    limitCents: 30000,
  });
});

it('recusa destino já preenchido e não altera o registro existente', async () => {
  const otherUser = randomUUID();
  await api.pool.query('INSERT INTO neon_auth."user"(id) VALUES($1)', [otherUser]);
  const otherCredentials = await api.signToken(otherUser);
  const otherBackup = exportCloudBackup(fixture);
  const first = await fetch(api.origin + '/api/finance?operation=import', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + otherCredentials.token,
      'X-SaldoLab-Session-Id': otherCredentials.sessionId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ backup: otherBackup }),
  });
  expect(first.status).toBe(201);
  const before = await snapshot(api.pool, otherUser);
  const second = await fetch(api.origin + '/api/finance?operation=import', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + otherCredentials.token,
      'X-SaldoLab-Session-Id': otherCredentials.sessionId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ backup: otherBackup }),
  });
  expect(second.status).toBe(409);
  expect(await snapshot(api.pool, otherUser)).toEqual(before);
});

it('rejeita backup inválido e não grava registros', async () => {
  const response = await importRequest({ backup: '{arquivo inválido' });
  expect(response.status).toBe(422);
  expect((await snapshot(api.pool, userId)).accounts).toHaveLength(1);
  const emptyUser = randomUUID();
  await api.pool.query('INSERT INTO neon_auth."user"(id) VALUES($1)', [emptyUser]);
  const emptyCredentials = await api.signToken(emptyUser);
  const invalid = await fetch(api.origin + '/api/finance?operation=import', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + emptyCredentials.token,
      'X-SaldoLab-Session-Id': emptyCredentials.sessionId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ backup: '{arquivo inválido' }),
  });
  expect(invalid.status).toBe(422);
  expect((await snapshot(api.pool, emptyUser)).accounts).toHaveLength(0);
});

it('exige autenticação e sessão ativa antes de importar', async () => {
  const anonymous = await importRequest({ backup }, null);
  expect(anonymous.status).toBe(401);
  const expiredSession = await fetch(api.origin + '/api/finance?operation=import', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + credentials.token,
      'X-SaldoLab-Session-Id': randomUUID(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ backup }),
  });
  expect(expiredSession.status).toBe(401);
});

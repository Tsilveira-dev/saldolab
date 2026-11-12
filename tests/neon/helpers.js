import { request, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

export const localKey = 'saldolab:v1:personal';
export const localFixture = {
  version: 1,
  accounts: [
    {
      id: 'qa-local-only',
      name: 'QA apenas local',
      type: 'checking',
      initialBalanceCents: 43210,
      color: '#123456',
      icon: 'bank',
      createdAt: '2026-11-12',
    },
  ],
  categories: [],
  transactions: [],
  budgets: [],
};
export const account = (name) => ({
  name,
  type: 'checking',
  initialBalanceCents: 100000,
  color: '#123456',
  icon: 'bank',
  createdAt: '2026-11-12',
});
export const category = (name, type = 'expense') => ({ name, type, color: '#123456', icon: 'tag' });
export const transaction = (accountId, categoryId, changes = {}) => ({
  description: 'QA transação',
  type: 'expense',
  amountCents: 75000,
  categoryId,
  accountId,
  destinationAccountId: null,
  date: '2026-11-12',
  status: 'confirmed',
  notes: '',
  ...changes,
});

export async function privateFill(locator, value) {
  // Avoid Playwright's fill call log containing a password if an action fails.
  await locator.evaluate((element, secret) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, secret);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}
export async function signIn(actor) {
  await actor.page.goto('/nuvem');
  await actor.page.getByLabel('E-mail', { exact: true }).fill(actor.email);
  await privateFill(actor.page.getByLabel('Senha', { exact: true }), actor.password);
  await actor.page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(
    actor.page.getByRole('button', { name: /Abrir finanças na nuvem|Atualizar dados/ }),
  ).toBeVisible();
}
export async function createActor(browser, suffix) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  // Forward to the actual HTTPS service through the environment proxy, with
  // certificate validation enabled. No auth/API response is mocked here.
  const transport = process.env.HTTPS_PROXY
    ? await request.newContext({ proxy: { server: process.env.HTTPS_PROXY } })
    : null;
  if (transport)
    await context.route(new URL(process.env.VITE_NEON_AUTH_URL).origin + '/**', async (route) =>
      route.fulfill({ response: await transport.fetch(route.request()) }),
    );
  await context.addInitScript(
    ({ key, fixture }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(fixture));
    },
    { key: localKey, fixture: localFixture },
  );
  const page = await context.newPage();
  const actor = {
    context,
    page,
    transport,
    email: `saldolab-qa-${suffix}-${randomUUID()}@example.com`,
    password: randomUUID() + 'Aa1!',
  };
  await page.goto('/nuvem');
  await page.getByRole('button', { name: 'Quero criar uma conta' }).click();
  await page.getByLabel('Seu nome').fill('QA PR3 ' + suffix);
  await page.getByLabel('E-mail', { exact: true }).fill(actor.email);
  await privateFill(page.getByLabel('Senha', { exact: true }), actor.password);
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Abrir finanças na nuvem' })).toBeVisible({
    timeout: 30000,
  });
  actor.id = await page.evaluate(
    async () =>
      (await (await import('/src/auth/neonClient.js')).authClient.getSession()).data.user.id,
  );
  return actor;
}
export async function api(page, method = 'GET', entity, id, body) {
  return page.evaluate(
    async ({ method, entity, id, body }) => {
      const { getAuthToken } = await import('/src/auth/neonClient.js');
      const token = await getAuthToken();
      const params = new URLSearchParams();
      if (entity) params.set('entity', entity);
      if (id) params.set('id', id);
      const result = await fetch('/api/finance?' + params, {
        method,
        headers: {
          Authorization: 'Bearer ' + token,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: result.status, body: await result.json() };
    },
    { method, entity, id, body },
  );
}
export async function create(page, entity, body) {
  const response = await api(page, 'POST', entity, undefined, body);
  expect(response.status).toBe(201);
  return response.body;
}
export async function openCloud(page) {
  await page.goto('/nuvem');
  await page.getByRole('button', { name: /Abrir finanças na nuvem|Atualizar dados/ }).click();
  await page.goto('/contas');
  await expect(page.getByRole('button', { name: 'Adicionar conta', exact: true })).toBeEnabled();
}

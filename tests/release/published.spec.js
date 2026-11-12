import { test, expect, request } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import pg from 'pg';
import { assertIsolatedDatabase } from '../integration/harness.js';
import { privateFill, account, category, transaction } from '../neon/helpers.js';

test.describe.configure({ mode: 'serial' });
const app = new URL(process.env.SALDOLAB_RELEASE_BASE_URL),
  auth = new URL(process.env.NEON_AUTH_BASE_URL);
let pool, a, b, fixture, backup;
const resources = [];
const tokens = new WeakMap();
async function device(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const transport = await request.newContext({
    proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined,
  });
  resources.push({ context, transport });
  await context.route('**/*.neonauth.*/**', async (route) => {
    if (new URL(route.request().url()).origin !== auth.origin) {
      await route.abort();
      return;
    }
    try {
      await route.fulfill({
        response: await transport.fetch(route.request(), { maxRedirects: 0 }),
      });
    } catch {
      await route.abort();
    }
  });
  await context.route(app.origin + '/**', async (route) => {
    const headers = { ...route.request().headers() };
    if (process.env.VERCEL_OIDC_TOKEN)
      headers['x-vercel-trusted-oidc-idp-token'] = process.env.VERCEL_OIDC_TOKEN;
    try {
      await route.fulfill({
        response: await transport.fetch(route.request(), { headers, maxRedirects: 0 }),
      });
    } catch {
      await route.abort();
    }
  });
  const page = await context.newPage();
  page.on('request', (req) => {
    const url = new URL(req.url()),
      authorization = req.headers().authorization;
    if (
      url.origin === app.origin &&
      url.pathname === '/api/finance' &&
      authorization?.startsWith('Bearer ')
    )
      tokens.set(page, authorization.slice(7));
  });
  return page;
}
async function login(page, credentials = fixture) {
  await page.goto('/nuvem');
  await page.getByLabel('E-mail', { exact: true }).fill(credentials.email);
  await privateFill(page.getByLabel('Senha', { exact: true }), credentials.password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(
    page.getByRole('button', { name: /Abrir finanças na nuvem|Atualizar dados/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: /Abrir finanças na nuvem|Atualizar dados/ }).click();
  await page.goto('/contas');
  await expect(
    page.locator('.page-heading').getByRole('button', { name: 'Adicionar conta', exact: true }),
  ).toBeEnabled();
  expect(tokens.has(page)).toBe(true);
}
async function provider(page, path, body) {
  return page.evaluate(
    async ({ base, path, body }) => {
      try {
        const r = await fetch(base + path, {
          method: body ? 'POST' : 'GET',
          credentials: 'include',
          headers: body ? { 'Content-Type': 'application/json' } : {},
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        let data = null;
        try {
          data = await r.json();
        } catch {
          /* Only status is needed for an empty response. */
        }
        return { status: r.status, hasUser: !!data?.user };
      } catch {
        return { status: 0, hasUser: true };
      }
    },
    { base: auth.href.replace(/\/$/, ''), path, body },
  );
}
async function api(page, method, entity, body, bearer = tokens.get(page)) {
  return page.evaluate(
    async ({ method, entity, body, bearer }) => {
      const r = await fetch('/api/finance' + (entity ? '?entity=' + entity : ''), {
        method,
        headers: {
          Authorization: 'Bearer ' + bearer,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: r.status, body: await r.json() };
    },
    { method, entity, body, bearer },
  );
}
test.beforeAll(async ({ browser }) => {
  pool = new pg.Pool({ connectionString: process.env.SALDOLAB_TEST_DATABASE_URL });
  pool.on('error', () => {});
  await assertIsolatedDatabase(pool, process.env.SALDOLAB_TEST_DATABASE_URL);
  const marker = await pool.query('SELECT purpose FROM saldolab_qa.environment');
  expect(marker.rows[0].purpose).toBe('isolated release validation');
  a = await device(browser);
  b = await device(browser);
  fixture = {
    email: 'qa-release-' + randomUUID() + '@example.com',
    password: randomUUID() + 'Aa1!',
  };
});
test.afterAll(async () => {
  for (const r of resources) {
    await r.context.close();
    await r.transport.dispose();
  }
  await pool?.end();
});

test('Preview publicado exige verificação e não concede sessão antes dela', async () => {
  await a.goto('/nuvem');
  await a.getByRole('button', { name: 'Quero criar uma conta' }).click();
  await a.getByLabel('Seu nome').fill('QA aceite v1');
  await a.getByLabel('E-mail', { exact: true }).fill(fixture.email);
  await privateFill(a.getByLabel('Senha', { exact: true }), fixture.password);
  const signup = a.waitForResponse(
    (r) => r.url() === auth.href.replace(/\/$/, '') + '/sign-up/email',
  );
  await a.getByRole('button', { name: 'Criar conta', exact: true }).click();
  const response = await signup;
  expect(response.status()).toBe(200);
  const data = await response.json();
  fixture.id = data.user.id;
  expect(data.user.emailVerified).toBe(false);
  expect(!!data.token).toBe(false);
  await expect(a.getByRole('heading', { name: 'Verificar meu e-mail' })).toBeVisible();
  // Fixture preparation only. OTP values are protected by the provider; never
  // weaken storage or query the controlled mailbox's code to automate this.
  // Real mailbox and OTP acceptance are a separate human gate.
  expect(fixture.email.startsWith('qa-release-')).toBe(true);
  await pool.query('UPDATE neon_auth."user" SET "emailVerified"=true WHERE id=$1 AND email=$2', [
    fixture.id,
    fixture.email,
  ]);
  await a.getByRole('button', { name: 'Voltar ao login' }).click();
  await login(a);
  await login(b);
});

test('logout global da UI revoga sessões reais; janela do JWT emitido é registrada', async () => {
  const jwt = tokens.get(a),
    claims = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());
  expect(claims.exp - claims.iat).toBe(900);
  await a.goto('/nuvem');
  await a.getByRole('button', { name: 'Sair de todos os dispositivos' }).click();
  await expect(a.getByRole('heading', { name: 'Entrar na minha conta' })).toBeVisible();
  expect(
    (
      await pool.query('SELECT count(*)::int AS n FROM neon_auth.session WHERE "userId"=$1', [
        fixture.id,
      ])
    ).rows[0].n,
  ).toBe(0);
  const other = await provider(b, '/get-session?disableCookieCache=true');
  expect([200, 401].includes(other.status)).toBe(true);
  expect(other.hasUser).toBe(false);
  const old = await api(a, 'GET', undefined, undefined, jwt);
  expect(old.status).toBe(200);
  test.info().annotations.push({
    type: 'security-residual',
    description:
      'Global provider sessions revoked; already issued stateless JWT still accepted until exp (900s plus 10s tolerance).',
  });
  await login(a);
  await login(b);
});

test('mudança de senha revoga outro dispositivo e recuperação revoga todas as sessões', async () => {
  const changed = randomUUID() + 'Aa2!';
  const change = await provider(a, '/change-password', {
    currentPassword: fixture.password,
    newPassword: changed,
    revokeOtherSessions: true,
  });
  expect(change.status).toBe(200);
  fixture.password = changed;
  const other = await provider(b, '/get-session?disableCookieCache=true');
  expect([200, 401].includes(other.status)).toBe(true);
  expect(other.hasUser).toBe(false);
  await login(b);
  const sent = await provider(a, '/request-password-reset', {
    email: fixture.email,
    redirectTo: app.origin + '/nuvem',
  });
  expect(sent.status).toBe(200);
  const row = await pool.query(
    'SELECT identifier FROM neon_auth.verification WHERE value=$1 ORDER BY "createdAt" DESC LIMIT 1',
    [fixture.id],
  );
  expect(row.rowCount).toBe(1);
  const identifier = row.rows[0].identifier;
  expect(identifier.startsWith('reset-password:')).toBe(true);
  await a.goto('/nuvem');
  await a.evaluate((token) => {
    history.replaceState(null, '', '/nuvem?token=' + encodeURIComponent(token));
    location.reload();
  }, identifier.slice('reset-password:'.length));
  await expect(a.getByRole('heading', { name: 'Redefinir senha' })).toBeVisible();
  expect(new URL(a.url()).search).toBe('');
  const password = randomUUID() + 'Aa3!';
  await privateFill(a.getByLabel('Nova senha', { exact: true }), password);
  await privateFill(a.getByLabel('Confirme a nova senha'), password);
  await a.getByRole('button', { name: 'Salvar nova senha' }).click();
  await expect(a.getByText('Senha redefinida. Entre novamente com sua nova senha.')).toBeVisible();
  fixture.password = password;
  expect(
    (
      await pool.query('SELECT count(*)::int AS n FROM neon_auth.session WHERE "userId"=$1', [
        fixture.id,
      ])
    ).rows[0].n,
  ).toBe(0);
  const revoked = await provider(b, '/get-session?disableCookieCache=true');
  expect([200, 401].includes(revoked.status)).toBe(true);
  expect(revoked.hasUser).toBe(false);
  await a.getByRole('button', { name: 'Voltar ao login' }).click();
  await login(a);
});

test('exporta backup da nuvem pela UI publicada sem revisões, sessões ou identidade', async () => {
  const create = async (entity, values) => {
    const r = await api(a, 'POST', entity, values);
    expect(r.status).toBe(201);
    return r.body;
  };
  const current = await create('accounts', account('QA backup corrente')),
    reserve = await create('accounts', { ...account('QA backup reserva'), initialBalanceCents: 0 });
  const income = await create('categories', category('QA receita', 'income')),
    expense = await create('categories', category('QA despesa'));
  await create(
    'transactions',
    transaction(current.id, income.id, { type: 'income', amountCents: 250000 }),
  );
  await create('transactions', transaction(current.id, expense.id));
  await create(
    'transactions',
    transaction(current.id, null, {
      type: 'transfer',
      destinationAccountId: reserve.id,
      amountCents: 20000,
    }),
  );
  await create(
    'transactions',
    transaction(current.id, expense.id, { status: 'pending', amountCents: 12345 }),
  );
  await create('budgets', { categoryId: expense.id, month: '2026-11', limitCents: 100000 });
  await a.goto('/configuracoes');
  await expect(a.getByRole('button', { name: 'Importar backup', exact: true })).toBeDisabled();
  const pending = a.waitForEvent('download');
  await a.getByRole('button', { name: 'Exportar backup JSON' }).click();
  const download = await pending;
  await download.saveAs('work/launch-v1/fictitious-cloud-backup.json');
  const { readFile } = await import('node:fs/promises');
  backup = await readFile('work/launch-v1/fictitious-cloud-backup.json', 'utf8');
  const parsed = JSON.parse(backup);
  expect(parsed.app).toBe('SaldoLab');
  expect(parsed.data.version).toBe(1);
  expect(parsed.data.accounts).toHaveLength(2);
  expect(parsed.data.transactions).toHaveLength(4);
  expect(backup.includes('revision')).toBe(false);
  expect(backup.includes(fixture.email)).toBe(false);
  expect(backup.includes(tokens.get(a))).toBe(false);
  await writeFile('work/launch-v1/release-fixture.json', JSON.stringify({ id: fixture.id }), {
    mode: 0o600,
  });
});

test('transação sem categorias conclui cadastro, edição e exclusão no Preview em desktop/mobile', async ({
  browser,
}) => {
  for (const width of [1440, 390]) {
    const page = await device(browser);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/nuvem');
    const credentials = {
      email: 'qa-release-guide-' + randomUUID() + '@example.com',
      password: randomUUID() + 'Aa1!',
    };
    const registered = await page.evaluate(
      async ({ base, email, password }) => {
        const r = await fetch(base + '/sign-up/email', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'QA categoria guiada', email, password }),
        });
        const data = await r.json();
        return { status: r.status, id: data.user?.id };
      },
      { base: auth.href.replace(/\/$/, ''), ...credentials },
    );
    expect(registered.status).toBe(200);
    expect(credentials.email.startsWith('qa-release-guide-')).toBe(true);
    await pool.query('UPDATE neon_auth."user" SET "emailVerified"=true WHERE id=$1 AND email=$2', [
      registered.id,
      credentials.email,
    ]);
    await login(page, credentials);
    expect((await api(page, 'POST', 'accounts', account('QA conta guiada'))).status).toBe(201);
    await page.goto('/transacoes');
    await page
      .locator('.page-heading')
      .getByRole('button', { name: 'Nova transação', exact: true })
      .click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('[name=description]').fill('QA lançamento guiado');
    await dialog.locator('[name=amount]').fill('10,00');
    await expect(
      dialog.getByRole('button', { name: 'Adicionar registro', exact: true }),
    ).toBeDisabled();
    await dialog.getByLabel('Nome da nova categoria').fill('QA categoria guiada');
    await dialog.getByRole('button', { name: 'Criar categoria de despesa', exact: true }).click();
    await expect(dialog.locator('[name=categoryId] option:checked')).toHaveText(
      'QA categoria guiada',
    );
    await expect(dialog.locator('[name=description]')).toHaveValue('QA lançamento guiado');
    await expect(dialog.locator('[name=amount]')).toHaveValue('10,00');
    await dialog.getByRole('button', { name: 'Adicionar registro', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page.getByRole('button', { name: 'Editar QA lançamento guiado', exact: true }).click();
    await dialog.locator('[name=amount]').fill('20,00');
    await dialog.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(dialog).toHaveCount(0);
    const stored = await pool.query(
      'SELECT amount_cents FROM public.transactions WHERE user_id=$1',
      [registered.id],
    );
    expect(stored.rows[0].amount_cents).toBe('2000');
    await page.getByRole('button', { name: 'Excluir QA lançamento guiado', exact: true }).click();
    await dialog.getByRole('button', { name: 'Excluir registro', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(
      (
        await pool.query('SELECT count(*)::int AS n FROM public.transactions WHERE user_id=$1', [
          registered.id,
        ])
      ).rows[0].n,
    ).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
  }
});

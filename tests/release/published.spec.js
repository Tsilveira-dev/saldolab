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
const sessionCredentials = new WeakMap();
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
      sessionCredentials.set(page, {
        token: authorization.slice(7),
        sessionId: req.headers()['x-saldolab-session-id'],
      });
  });
  return page;
}
async function login(page, credentials = fixture) {
  await page.goto('/nuvem');
  const email = page.getByLabel('E-mail', { exact: true });
  const open = page.getByRole('button', { name: /Abrir finanças na nuvem|Atualizar dados/ });
  await expect(email.or(open)).toBeVisible();
  if (await email.isVisible()) {
    await email.fill(credentials.email);
    await privateFill(page.getByLabel('Senha', { exact: true }), credentials.password);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  }
  await expect(
    page.getByRole('button', { name: /Abrir finanças na nuvem|Atualizar dados/ }),
  ).toBeVisible();
  const loaded = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.origin === app.origin &&
      url.pathname === '/api/finance' &&
      !url.searchParams.has('entity') &&
      response.request().method() === 'GET'
    );
  });
  await page.getByRole('button', { name: /Abrir finanças na nuvem|Atualizar dados/ }).click();
  expect((await loaded).status()).toBe(200);
  await page.goto('/contas');
  await expect(
    page.locator('.page-heading').getByRole('button', { name: 'Adicionar conta', exact: true }),
  ).toBeEnabled();
  expect(sessionCredentials.get(page)?.sessionId).toBeTruthy();
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
async function api(page, method, entity, body, credential = sessionCredentials.get(page), id) {
  return page.evaluate(
    async ({ method, entity, body, bearer, sessionId, id }) => {
      const params = new URLSearchParams();
      if (entity) params.set('entity', entity);
      if (id) params.set('id', id);
      const r = await fetch('/api/finance?' + params, {
        method,
        headers: {
          Authorization: 'Bearer ' + bearer,
          ...(sessionId ? { 'X-SaldoLab-Session-Id': sessionId } : {}),
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: r.status, body: await r.json() };
    },
    { method, entity, body, bearer: credential.token, sessionId: credential.sessionId, id },
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

test('logout individual recusa o JWT com a sessão anterior e preserva o outro dispositivo', async () => {
  const previous = sessionCredentials.get(a);
  expect((await api(a, 'GET', undefined, undefined, previous)).status).toBe(200);
  await a.goto('/nuvem');
  await a.getByRole('button', { name: 'Sair da conta', exact: true }).click();
  await expect(a.getByRole('heading', { name: 'Entrar na minha conta' })).toBeVisible();
  expect((await api(a, 'GET', undefined, undefined, previous)).status).toBe(401);
  expect((await api(b, 'GET')).status).toBe(200);
  expect((await api(a, 'GET', undefined, undefined, { token: previous.token })).status).toBe(401);
  await login(a);
  expect((await api(a, 'GET', undefined, undefined, previous)).status).toBe(401);
});

test('logout global da UI impede novos acessos com os dois pares JWT/sessão anteriores', async () => {
  const previousA = sessionCredentials.get(a),
    previousB = sessionCredentials.get(b),
    jwt = previousA.token,
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
  expect((await api(a, 'GET', undefined, undefined, previousA)).status).toBe(401);
  expect((await api(b, 'GET', undefined, undefined, previousB)).status).toBe(401);
  await login(a);
  await login(b);
  expect((await api(a, 'GET', undefined, undefined, previousA)).status).toBe(401);
});

test('mudança de senha rotaciona a sessão atual e recuperação revoga todas as anteriores', async () => {
  const previousB = sessionCredentials.get(b);
  // Refresh the capture on A: the previous assertion deliberately replayed an old pair.
  await login(a);
  const currentA = sessionCredentials.get(a);
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
  expect((await api(b, 'GET', undefined, undefined, previousB)).status).toBe(401);
  expect((await api(a, 'GET', undefined, undefined, currentA)).status).toBe(401);
  await a.reload();
  await login(a);
  await login(b);
  const beforeResetA = sessionCredentials.get(a),
    beforeResetB = sessionCredentials.get(b);
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
  expect((await api(a, 'GET', undefined, undefined, beforeResetA)).status).toBe(401);
  expect(
    (await api(b, 'POST', 'accounts', account('QA escrita revogada'), beforeResetB)).status,
  ).toBe(401);
  await a.getByRole('button', { name: 'Voltar ao login' }).click();
  await login(a);
  expect((await api(a, 'GET', undefined, undefined, beforeResetA)).status).toBe(401);
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
  expect(backup.includes(sessionCredentials.get(a).token)).toBe(false);
  expect(backup.includes(sessionCredentials.get(a).sessionId)).toBe(false);
  const beforeReload = (await api(a, 'GET')).body;
  await a.reload();
  expect((await api(a, 'GET')).body).toEqual(beforeReload);
  await a.goto('/nuvem');
  await a.getByRole('button', { name: 'Sair da conta', exact: true }).click();
  await login(a);
  expect((await api(a, 'GET')).body).toEqual(beforeReload);
  const balances = new Map(parsed.data.accounts.map((row) => [row.id, row.initialBalanceCents]));
  let revenue = 0,
    expenses = 0;
  for (const row of parsed.data.transactions) {
    expect(Number.isSafeInteger(row.amountCents)).toBe(true);
    if (row.status !== 'confirmed') continue;
    if (row.type === 'income') {
      revenue += row.amountCents;
      balances.set(row.accountId, balances.get(row.accountId) + row.amountCents);
    } else {
      balances.set(row.accountId, balances.get(row.accountId) - row.amountCents);
    }
    if (row.type === 'expense') expenses += row.amountCents;
    if (row.type === 'transfer')
      balances.set(
        row.destinationAccountId,
        balances.get(row.destinationAccountId) + row.amountCents,
      );
  }
  expect({
    revenue,
    expenses,
    current: balances.get(current.id),
    reserve: balances.get(reserve.id),
  }).toEqual({ revenue: 250000, expenses: 75000, current: 255000, reserve: 20000 });
  await writeFile('work/launch-v1/release-fixture.json', JSON.stringify({ id: fixture.id }), {
    mode: 0o600,
  });
});

test('outra identidade não lê, edita ou exclui registros do titular fictício no Preview', async ({
  browser,
}) => {
  const page = await device(browser);
  const other = {
    email: 'qa-release-isolation-' + randomUUID() + '@example.com',
    password: randomUUID() + 'Aa1!',
  };
  await page.goto('/nuvem');
  const registered = await page.evaluate(
    async ({ base, values }) => {
      const response = await fetch(base + '/sign-up/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await response.json();
      return { status: response.status, id: data.user?.id };
    },
    { base: auth.href.replace(/\/$/, ''), values: { name: 'QA isolamento', ...other } },
  );
  expect(registered.status).toBe(200);
  const user = { id: registered.id };
  await pool.query('UPDATE neon_auth."user" SET "emailVerified"=true WHERE id=$1 AND email=$2', [
    user.id,
    other.email,
  ]);
  await login(page, other);
  expect((await api(page, 'GET')).body.accounts).toEqual([]);
  const source = (await api(a, 'GET')).body;
  for (const entity of ['accounts', 'categories', 'transactions', 'budgets']) {
    const row = source[entity][0];
    for (const method of ['GET', 'PATCH', 'DELETE']) {
      const changed =
        entity === 'transactions'
          ? { amountCents: 1 }
          : entity === 'budgets'
            ? { limitCents: 1 }
            : { name: 'QA não alterar' };
      const body =
        method === 'GET'
          ? undefined
          : {
              expectedRevision: row.revision,
              ...(method === 'PATCH' ? changed : {}),
            };
      expect((await api(page, method, entity, body, undefined, row.id)).status).toBe(404);
    }
  }
  expect((await api(a, 'GET')).body).toEqual(source);
});

for (const type of ['expense', 'income'])
  test(`transação ${type} sem contas/categorias usa cadastro rápido e CRUD no Preview desktop/mobile`, async ({
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
      await pool.query(
        'UPDATE neon_auth."user" SET "emailVerified"=true WHERE id=$1 AND email=$2',
        [registered.id, credentials.email],
      );
      await login(page, credentials);
      await page.goto('/transacoes');
      await page
        .locator('.page-heading')
        .getByRole('button', { name: 'Nova transação', exact: true })
        .click();
      const dialog = page.getByRole('dialog');
      await dialog.locator('[name=type]').selectOption(type);
      await dialog.locator('[name=description]').fill('QA lançamento guiado');
      await dialog.locator('[name=amount]').fill('10,00');
      await expect(
        dialog.getByRole('button', { name: 'Adicionar registro', exact: true }),
      ).toBeDisabled();
      await dialog.getByLabel('Nome da nova conta').fill('QA conta guiada');
      await dialog.getByLabel('Saldo inicial da conta (R$)').fill('1000,00');
      await dialog.getByRole('button', { name: 'Criar conta e selecionar', exact: true }).click();
      await expect(dialog.locator('[name=accountId] option:checked')).toHaveText('QA conta guiada');
      await expect(dialog.locator('[name=description]')).toHaveValue('QA lançamento guiado');
      await expect(dialog.locator('[name=amount]')).toHaveValue('10,00');
      await dialog.getByLabel('Nome da nova categoria').fill('QA categoria guiada');
      await dialog
        .getByRole('button', {
          name: 'Criar categoria de ' + (type === 'income' ? 'receita' : 'despesa'),
          exact: true,
        })
        .click();
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
      const state = (await api(page, 'GET')).body;
      expect(state.accounts[0].initialBalanceCents).toBe(100000);
      await page.reload();
      expect((await api(page, 'GET')).body).toEqual(state);
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
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
    }
  });

for (const width of [1440, 390])
  test(`troca A→B→A na mesma aba não mostra finanças anteriores nem muda para dados locais (${width}px)`, async ({
    browser,
  }) => {
    const page = await device(browser);
    await page.setViewportSize({ width, height: 900 });
    const local = {
      version: 1,
      accounts: [{ ...account('QA local independente'), id: 'local-only' }],
      categories: [],
      transactions: [],
      budgets: [],
    };
    await page.goto('/nuvem');
    await page.evaluate(
      (value) => localStorage.setItem('saldolab:v1:personal', JSON.stringify(value)),
      local,
    );
    const register = async (label) => {
      const values = {
        email: 'qa-release-switch-' + randomUUID() + '@example.com',
        password: randomUUID() + 'Aa1!',
      };
      await page.getByRole('button', { name: 'Quero criar uma conta', exact: true }).click();
      await page.getByLabel('Seu nome').fill('QA identidade ' + label);
      await page.getByLabel('E-mail', { exact: true }).fill(values.email);
      await privateFill(page.getByLabel('Senha', { exact: true }), values.password);
      const pending = page.waitForResponse(
        (r) => r.url() === auth.href.replace(/\/$/, '') + '/sign-up/email',
      );
      await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
      const response = await pending;
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.user.emailVerified).toBe(false);
      await expect(page.getByRole('heading', { name: 'Verificar meu e-mail' })).toBeVisible();
      await pool.query(
        'UPDATE neon_auth."user" SET "emailVerified"=true WHERE id=$1 AND email=$2',
        [data.user.id, values.email],
      );
      await page.getByRole('button', { name: 'Voltar ao login', exact: true }).click();
      return { ...values, id: data.user.id };
    };
    const signInWithoutModeButton = async (values) => {
      await page.getByLabel('E-mail', { exact: true }).fill(values.email);
      await privateFill(page.getByLabel('Senha', { exact: true }), values.password);
      await page.getByRole('button', { name: 'Entrar', exact: true }).click();
      await expect(page.locator('strong').filter({ hasText: values.email })).toBeVisible();
      await page.goto('/contas');
      await expect(page.getByText('Neon PostgreSQL', { exact: true })).toBeVisible();
      await expect(
        page.locator('.page-heading').getByRole('button', { name: 'Adicionar conta', exact: true }),
      ).toBeEnabled();
    };
    const signOut = async () => {
      await page.goto('/nuvem');
      await page.getByRole('button', { name: 'Sair da conta', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Entrar na minha conta' })).toBeVisible();
      await page.goto('/contas');
      await expect(page.getByText('QA exclusivo A', { exact: true })).toHaveCount(0);
      await expect(page.getByText('QA exclusivo B', { exact: true })).toHaveCount(0);
      await expect(page.getByText('QA local independente', { exact: true })).toHaveCount(0);
      await expect(page.getByText('Neon PostgreSQL', { exact: true })).toBeVisible();
      await page.goto('/nuvem');
    };
    const first = await register('A');
    await login(page, first);
    expect((await api(page, 'POST', 'accounts', account('QA exclusivo A'))).status).toBe(201);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'QA exclusivo A', exact: true })).toBeVisible();
    await signOut();
    const second = await register('B');
    await signInWithoutModeButton(second);
    await expect(page.getByText('QA exclusivo A', { exact: true })).toHaveCount(0);
    expect((await api(page, 'GET')).body.accounts).toEqual([]);
    expect((await api(page, 'POST', 'accounts', account('QA exclusivo B'))).status).toBe(201);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'QA exclusivo B', exact: true })).toBeVisible();
    await signOut();
    await signInWithoutModeButton(first);
    await expect(page.getByRole('heading', { name: 'QA exclusivo A', exact: true })).toBeVisible();
    await expect(page.getByText('QA exclusivo B', { exact: true })).toHaveCount(0);
    expect((await api(page, 'GET')).body.accounts.map((row) => row.name)).toEqual([
      'QA exclusivo A',
    ]);
    expect(
      await page.evaluate(() => JSON.parse(localStorage.getItem('saldolab:v1:personal'))),
    ).toEqual(local);
    const rows = await pool.query(
      'SELECT user_id,name FROM public.accounts WHERE user_id=ANY($1::text[]) ORDER BY name',
      [[first.id, second.id]],
    );
    expect(rows.rows).toEqual([
      { user_id: first.id, name: 'QA exclusivo A' },
      { user_id: second.id, name: 'QA exclusivo B' },
    ]);
  });

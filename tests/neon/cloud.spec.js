import { test, expect } from '@playwright/test';
import pg from 'pg';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { randomUUID } from 'node:crypto';
import { assertIsolatedDatabase } from '../integration/harness.js';
import {
  createActor,
  signIn,
  openCloud,
  privateFill,
  api,
  create,
  account,
  category,
  transaction,
  localKey,
  localFixture,
} from './helpers.js';

let pool, a, b, finance;
test.beforeAll(async ({ browser }) => {
  pool = new pg.Pool({ connectionString: process.env.SALDOLAB_TEST_DATABASE_URL });
  await assertIsolatedDatabase(pool, process.env.SALDOLAB_TEST_DATABASE_URL);
  a = await createActor(browser, 'a');
  b = await createActor(browser, 'b');
});
test.afterAll(async () => {
  for (const actor of [a, b]) {
    await actor?.context.close();
    await actor?.transport?.dispose();
  }
  await pool?.end();
});

test('SDK 0.8.2 fornece JWT real aceito pelo JWKS e pela API; expiração é verificada', async () => {
  const token = await a.page.evaluate(async () =>
    (await import('/src/auth/neonClient.js')).getAuthToken(),
  );
  const jwks = createRemoteJWKSet(new URL(process.env.NEON_AUTH_JWKS_URL));
  const origin = new URL(process.env.NEON_AUTH_BASE_URL).origin;
  const verified = await jwtVerify(token, jwks, {
    algorithms: ['EdDSA'],
    issuer: origin,
    audience: origin,
    requiredClaims: ['sub', 'exp'],
  });
  expect(verified.payload.sub === a.id).toBe(true);
  expect(verified.payload.exp - verified.payload.iat).toBe(900);
  let expired = false;
  try {
    await jwtVerify(token, jwks, {
      issuer: origin,
      audience: origin,
      currentDate: new Date((verified.payload.exp + 11) * 1000),
    });
  } catch (error) {
    expired = error.code === 'ERR_JWT_EXPIRED';
  }
  expect(expired).toBe(true);
  expect((await api(a.page)).status).toBe(200);
  const remote = await a.page.evaluate(async () =>
    (await import('/src/repositories/remoteRepository.js')).createRemoteRepository().snapshot(),
  );
  expect(remote).toMatchObject({
    version: 1,
    accounts: [],
    categories: [],
    transactions: [],
    budgets: [],
  });
});

test('CRUD das quatro entidades confirma gravação, leitura, edição e exclusão no Neon SQL', async () => {
  const acc = await create(a.page, 'accounts', account('QA CRUD'));
  const cat = await create(a.page, 'categories', category('QA CRUD'));
  const rows = [
    [
      'transactions',
      await create(a.page, 'transactions', transaction(acc.id, cat.id)),
      { amountCents: 80001 },
    ],
    [
      'budgets',
      await create(a.page, 'budgets', { categoryId: cat.id, month: '2026-11', limitCents: 100000 }),
      { limitCents: 200001 },
    ],
    ['categories', cat, { name: 'QA CRUD editada' }],
    ['accounts', acc, { initialBalanceCents: 123456 }],
  ];
  for (const [entity, row, changes] of rows) {
    expect((await api(a.page, 'GET', entity, row.id)).body).toEqual(row);
    const updated = await api(a.page, 'PATCH', entity, row.id, { ...changes, expectedRevision: 1 });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ ...changes, revision: 2 });
    const sql = await pool.query(
      `SELECT revision FROM public.${entity} WHERE id=$1 AND user_id=$2`,
      [row.id, a.id],
    );
    expect(sql.rows[0].revision).toBe(2);
    expect((await api(a.page, 'DELETE', entity, row.id, { expectedRevision: 2 })).status).toBe(200);
    expect((await api(a.page, 'GET', entity, row.id)).status).toBe(404);
    expect(
      (
        await pool.query(
          `SELECT count(*)::int AS n FROM public.${entity} WHERE id=$1 AND user_id=$2`,
          [row.id, a.id],
        )
      ).rows[0].n,
    ).toBe(0);
  }
});

test('saldo, receita, despesa, pendência, transferência e orçamento mantêm centavos exatos', async () => {
  const current = await create(a.page, 'accounts', account('QA corrente'));
  const reserve = await create(a.page, 'accounts', {
    ...account('QA reserva'),
    initialBalanceCents: 0,
  });
  const income = await create(a.page, 'categories', category('QA receitas', 'income'));
  const expense = await create(a.page, 'categories', category('QA despesas'));
  await create(
    a.page,
    'transactions',
    transaction(current.id, income.id, { type: 'income', amountCents: 250000 }),
  );
  const tx = await create(a.page, 'transactions', transaction(current.id, expense.id));
  await create(
    a.page,
    'transactions',
    transaction(current.id, expense.id, { status: 'pending', amountCents: 12345 }),
  );
  await create(
    a.page,
    'transactions',
    transaction(current.id, null, {
      type: 'transfer',
      destinationAccountId: reserve.id,
      amountCents: 20000,
    }),
  );
  const budget = await create(a.page, 'budgets', {
    categoryId: expense.id,
    month: '2026-11',
    limitCents: 100000,
  });
  const result = await a.page.evaluate(
    async ({ current, reserve, budget }) => {
      const snapshot = await (
        await import('/src/repositories/remoteRepository.js')
      )
        .createRemoteRepository()
        .snapshot();
      const f = await import('/src/domain/finance.js');
      return {
        balance: f.totalBalance(snapshot.accounts, snapshot.transactions),
        current: f.accountBalance(current, snapshot.transactions),
        reserve: f.accountBalance(reserve, snapshot.transactions),
        totals: f.totals(snapshot.transactions),
        budget: f.budgetProgress(budget, snapshot.transactions),
        integerDates: snapshot.transactions.every(
          (tx) => Number.isInteger(tx.amountCents) && tx.date === '2026-11-12',
        ),
      };
    },
    { current, reserve, budget },
  );
  expect(result).toMatchObject({
    balance: 275000,
    current: 255000,
    reserve: 20000,
    totals: { income: 250000, expense: 75000, net: 175000, pendingCents: 12345, pendingCount: 1 },
    budget: { spent: 75000, percent: 75 },
    integerDates: true,
  });
  finance = { accounts: current, categories: expense, transactions: tx, budgets: budget };
});

test('dois usuários reais não leem, alteram, apagam nem vinculam registros alheios', async () => {
  const acc = await create(b.page, 'accounts', account('QA conta B'));
  const cat = await create(b.page, 'categories', category('QA categoria B'));
  const tx = await create(b.page, 'transactions', transaction(acc.id, cat.id));
  const budget = await create(b.page, 'budgets', {
    categoryId: cat.id,
    month: '2026-11',
    limitCents: 10000,
  });
  const theirs = { accounts: acc, categories: cat, transactions: tx, budgets: budget };
  for (const [actor, foreign] of [
    [b, finance],
    [a, theirs],
  ])
    for (const [entity, row] of Object.entries(foreign)) {
      expect((await api(actor.page, 'GET', entity)).body.some((item) => item.id === row.id)).toBe(
        false,
      );
      expect((await api(actor.page, 'GET', entity, row.id)).status).toBe(404);
      const changes =
        entity === 'accounts' || entity === 'categories'
          ? { name: 'QA acesso negado' }
          : entity === 'transactions'
            ? { amountCents: 1 }
            : { limitCents: 1 };
      expect(
        (await api(actor.page, 'PATCH', entity, row.id, { ...changes, expectedRevision: 1 }))
          .status,
      ).toBe(404);
      expect(
        (await api(actor.page, 'DELETE', entity, row.id, { expectedRevision: 1 })).status,
      ).toBe(404);
    }
  expect(
    (
      await api(
        b.page,
        'POST',
        'transactions',
        undefined,
        transaction(finance.accounts.id, finance.categories.id),
      )
    ).status,
  ).toBe(422);
  expect(
    (
      await api(a.page, 'POST', 'budgets', undefined, {
        categoryId: cat.id,
        month: '2026-11',
        limitCents: 1,
      })
    ).status,
  ).toBe(422);
  expect((await api(a.page, 'GET', 'accounts', finance.accounts.id)).body.initialBalanceCents).toBe(
    100000,
  );
});

test('duas abas produzem HTTP 200/409 nas quatro entidades e preservam a revisão vencedora', async () => {
  const other = await a.context.newPage();
  await other.goto('/nuvem');
  try {
    for (const [entity, row] of Object.entries(finance)) {
      const changes = (value) =>
        entity === 'accounts' || entity === 'categories'
          ? { name: 'QA concorrente ' + value }
          : entity === 'transactions'
            ? { amountCents: value }
            : { limitCents: value };
      const replies = await Promise.all([
        api(a.page, 'PATCH', entity, row.id, { ...changes(12345), expectedRevision: 1 }),
        api(other, 'PATCH', entity, row.id, { ...changes(67890), expectedRevision: 1 }),
      ]);
      expect(replies.map((r) => r.status).sort()).toEqual([200, 409]);
      const saved = (await api(a.page, 'GET', entity, row.id)).body;
      expect(saved).toEqual(replies.find((r) => r.status === 200).body);
      expect((await api(other, 'DELETE', entity, row.id, { expectedRevision: 1 })).status).toBe(
        409,
      );
      const sql = await pool.query(
        `SELECT revision FROM public.${entity} WHERE id=$1 AND user_id=$2`,
        [row.id, a.id],
      );
      expect(sql.rows[0].revision).toBe(2);
      finance[entity] = saved;
    }
  } finally {
    await other.close();
  }
});

test('UI persiste após reload e novo login, com armazenamento pessoal separado da nuvem', async () => {
  await openCloud(a.page);
  const name = 'QA persistência ' + randomUUID().slice(0, 8);
  await a.page.getByRole('button', { name: 'Adicionar conta', exact: true }).click();
  const dialog = a.page.getByRole('dialog');
  await dialog.locator('[name=name]').fill(name);
  await dialog.locator('[name=initialBalance]').fill('1000,00');
  await dialog.getByRole('button', { name: 'Adicionar registro' }).click();
  await expect(dialog).toHaveCount(0);
  await a.page.reload();
  await expect(a.page.getByRole('heading', { name, exact: true })).toBeVisible();
  await a.page.goto('/nuvem');
  await a.page.getByRole('button', { name: 'Sair da conta' }).click();
  await signIn(a);
  await openCloud(a.page);
  await expect(a.page.getByRole('heading', { name, exact: true })).toBeVisible();
  expect(
    (
      await pool.query(
        'SELECT initial_balance_cents FROM public.accounts WHERE user_id=$1 AND name=$2',
        [a.id, name],
      )
    ).rows[0].initial_balance_cents,
  ).toBe('100000');
  await a.page.getByLabel('Modo de uso').selectOption('personal');
  await expect(a.page.getByRole('heading', { name: 'QA apenas local', exact: true })).toBeVisible();
  await expect(a.page.getByRole('heading', { name, exact: true })).toHaveCount(0);
  expect(await a.page.evaluate((key) => JSON.parse(localStorage.getItem(key)), localKey)).toEqual(
    localFixture,
  );
  await openCloud(a.page);
  await expect(a.page.getByRole('heading', { name: 'QA apenas local', exact: true })).toHaveCount(
    0,
  );
  expect(
    (
      await pool.query(
        "SELECT count(*)::int AS n FROM public.accounts WHERE user_id=$1 AND id='qa-local-only'",
        [a.id],
      )
    ).rows[0].n,
  ).toBe(0);
});

test('conflito 409 fica visível no editor sem falsa mensagem de sucesso', async () => {
  await openCloud(a.page);
  const row = (await api(a.page, 'GET', 'accounts', finance.accounts.id)).body;
  await a.page.getByRole('button', { name: 'Editar ' + row.name, exact: true }).click();
  const dialog = a.page.getByRole('dialog');
  await dialog.locator('[name=name]').fill('QA edição perdida');
  expect(
    (
      await api(a.page, 'PATCH', 'accounts', row.id, {
        name: 'QA edição vencedora',
        expectedRevision: row.revision,
      })
    ).status,
  ).toBe(200);
  await dialog.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Registro alterado em outra sessão');
  await expect(a.page.getByText('Alterações salvas.', { exact: true })).toHaveCount(0);
  expect((await api(a.page, 'GET', 'accounts', row.id)).body.name).toBe('QA edição vencedora');
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
});

test('falha de rede permanece no formulário, sem sucesso ou gravação silenciosa', async () => {
  await openCloud(a.page);
  const name = 'QA falha de rede';
  await a.page.getByRole('button', { name: 'Adicionar conta', exact: true }).click();
  const dialog = a.page.getByRole('dialog');
  await dialog.locator('[name=name]').fill(name);
  await a.page.route('**/api/finance?entity=accounts', async (route) => {
    if (route.request().method() === 'POST') await route.abort('connectionfailed');
    else await route.continue();
  });
  try {
    await dialog.getByRole('button', { name: 'Adicionar registro' }).click();
    await expect(dialog.getByRole('alert')).toContainText('Não foi possível conectar ao servidor');
    await expect(a.page.getByText('Alterações salvas.', { exact: true })).toHaveCount(0);
    expect(
      (
        await pool.query(
          'SELECT count(*)::int AS n FROM public.accounts WHERE user_id=$1 AND name=$2',
          [a.id, name],
        )
      ).rows[0].n,
    ).toBe(0);
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
  } finally {
    await a.page.unroute('**/api/finance?entity=accounts');
  }
});

test('logout em outra aba retira dados antigos, bloqueia gravação e permite entrar como outro usuário', async () => {
  await openCloud(a.page);
  const other = await a.context.newPage();
  await other.goto('/contas');
  await expect(
    other.getByRole('heading', { name: 'QA edição vencedora', exact: true }),
  ).toBeVisible();
  await other.getByRole('button', { name: 'Editar QA edição vencedora', exact: true }).click();
  await expect(other.getByRole('dialog')).toBeVisible();
  await a.page.goto('/nuvem');
  await a.page.getByRole('button', { name: 'Sair da conta' }).click();
  await expect(
    other.getByRole('heading', { name: 'QA edição vencedora', exact: true }),
  ).toHaveCount(0);
  await expect(other.getByRole('button', { name: 'Adicionar conta', exact: true })).toHaveCount(0);
  await expect(other.getByRole('dialog')).toHaveCount(0);
  await expect(
    other.getByRole('heading', { name: 'Não foi possível abrir esta tela.' }),
  ).toHaveCount(0);
  await expect(other.getByText('Nuvem em somente leitura', { exact: true })).toBeVisible();
  await other.close();
  await a.page.getByLabel('E-mail', { exact: true }).fill(b.email);
  await privateFill(a.page.getByLabel('Senha', { exact: true }), b.password);
  await a.page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await openCloud(a.page);
  await expect(a.page.getByRole('heading', { name: 'QA conta B', exact: true })).toBeVisible();
  await expect(
    a.page.getByRole('heading', { name: 'QA edição vencedora', exact: true }),
  ).toHaveCount(0);
  await a.page.goto('/nuvem');
  await a.page.getByRole('button', { name: 'Sair da conta' }).click();
  await signIn(a);
});

test('desktop e mobile mantêm conteúdo e controles acessíveis sem rolagem horizontal', async () => {
  await openCloud(a.page);
  for (const width of [1440, 390]) {
    await a.page.setViewportSize({ width, height: 900 });
    for (const path of ['/', '/contas', '/categorias', '/transacoes', '/orcamentos', '/nuvem']) {
      await a.page.goto(path);
      await expect(a.page.locator('main h1')).toBeVisible();
      expect(
        await a.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      ).toBe(true);
    }
  }
  await a.page.setViewportSize({ width: 1440, height: 900 });
});

test('recuperação real redefine senha e impede reutilização do token; entrega SMTP permanece fora desta evidência', async () => {
  await a.page.goto('/nuvem');
  await a.page.getByRole('button', { name: 'Sair da conta' }).click();
  await a.page.getByRole('button', { name: 'Esqueci minha senha' }).click();
  await a.page.getByLabel('E-mail da sua conta').fill(a.email);
  await a.page.getByRole('button', { name: 'Enviar link de recuperação' }).click();
  await expect(a.page.getByText(/Se esse e-mail estiver cadastrado/)).toBeVisible({
    timeout: 30000,
  });
  let verification = await pool.query(
    'SELECT identifier, "expiresAt" > now() AS valid, extract(epoch from ("expiresAt"-"createdAt"))::int AS ttl_seconds FROM neon_auth.verification WHERE value=$1 ORDER BY "createdAt" DESC LIMIT 1',
    [a.id],
  );
  expect(verification.rowCount).toBe(1);
  expect(verification.rows[0].valid).toBe(true);
  test.info().annotations.push({
    type: 'evidence',
    description:
      'Provider password reset TTL: ' +
      verification.rows[0].ttl_seconds +
      ' seconds; mailbox delivery not observed.',
  });
  const expiredIdentifier = verification.rows[0].identifier;
  expect(expiredIdentifier.startsWith('reset-password:')).toBe(true);
  await pool.query(
    'UPDATE neon_auth.verification SET "expiresAt"=now()-interval \'1 minute\' WHERE value=$1 AND identifier=$2',
    [a.id, expiredIdentifier],
  );
  const expiredStatus = await a.page.evaluate(
    async ({ base, token, password }) =>
      (
        await fetch(base + '/reset-password', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, newPassword: password }),
        })
      ).status,
    {
      base: process.env.NEON_AUTH_BASE_URL,
      token: expiredIdentifier.slice('reset-password:'.length),
      password: randomUUID() + 'Aa2!',
    },
  );
  expect([400, 401].includes(expiredStatus)).toBe(true);
  const renewed = await a.page.evaluate(
    async ({ base, email }) =>
      (
        await fetch(base + '/request-password-reset', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, redirectTo: location.origin + '/nuvem' }),
        })
      ).status,
    { base: process.env.NEON_AUTH_BASE_URL, email: a.email },
  );
  expect(renewed).toBe(200);
  verification = await pool.query(
    'SELECT identifier FROM neon_auth.verification WHERE value=$1 ORDER BY "createdAt" DESC LIMIT 1',
    [a.id],
  );
  expect(verification.rowCount).toBe(1);
  expect(verification.rows[0].identifier !== expiredIdentifier).toBe(true);
  const identifier = verification.rows[0].identifier;
  expect(identifier.startsWith('reset-password:')).toBe(true);
  const token = identifier.slice('reset-password:'.length);
  await a.page.evaluate((token) => {
    window.history.replaceState(null, '', '/nuvem?token=' + encodeURIComponent(token));
    window.location.reload();
  }, token);
  await expect(a.page.getByRole('heading', { name: 'Redefinir senha' })).toBeVisible();
  expect(new URL(a.page.url()).search).toBe('');
  const newPassword = randomUUID() + 'Aa2!';
  await privateFill(a.page.getByLabel('Nova senha', { exact: true }), newPassword);
  await privateFill(a.page.getByLabel('Confirme a nova senha'), newPassword);
  await a.page.getByRole('button', { name: 'Salvar nova senha' }).click();
  await expect(
    a.page.getByText('Senha redefinida. Entre novamente com sua nova senha.'),
  ).toBeVisible();
  const reused = await a.page.evaluate(
    async ({ base, token, newPassword }) => {
      return (
        await fetch(base + '/reset-password', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, newPassword }),
        })
      ).status;
    },
    { base: process.env.NEON_AUTH_BASE_URL, token, newPassword },
  );
  expect([400, 401].includes(reused)).toBe(true);
  a.password = newPassword;
  await a.page.getByRole('button', { name: 'Voltar ao login' }).click();
  await signIn(a);
  await openCloud(a.page);
  await expect(
    a.page.getByRole('heading', { name: 'QA edição vencedora', exact: true }),
  ).toBeVisible();
});

test('sessão expirada no provedor não reabre dados nem operações após recarregar', async () => {
  // Only the two users created by this run may be touched in the isolated branch.
  expect(a.email.startsWith('saldolab-qa-')).toBe(true);
  await pool.query(
    'UPDATE neon_auth.session SET "expiresAt"=now()-interval \'1 minute\' WHERE "userId"=$1',
    [a.id],
  );
  // Remove the SDK/provider cookie cache as well, then let the real service
  // validate the expired database session on the next page load.
  const cookies = await a.context.cookies();
  await a.context.clearCookies();
  for (const cookie of cookies.filter((cookie) => !cookie.name.includes('session_data')))
    await a.context.addCookies([cookie]);
  await a.page.reload();
  await expect(a.page.getByRole('button', { name: 'Adicionar conta', exact: true })).toHaveCount(0);
  await expect(
    a.page.getByRole('heading', { name: 'QA edição vencedora', exact: true }),
  ).toHaveCount(0);
  await a.page.goto('/nuvem');
  await expect(a.page.getByRole('heading', { name: 'Entrar na minha conta' })).toBeVisible();
});

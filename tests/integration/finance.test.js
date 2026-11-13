import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { createIntegrationHarness } from './harness.js';
import { closeDatabasePool } from '../../api/_lib/db.js';
import { createRecord } from '../../api/_lib/finance.js';
import { totalBalance, accountBalance, totals, budgetProgress } from '../../src/domain/finance.js';

let api, owner, other, token, otherToken;
const account = (name = 'QA corrente') => ({
  name,
  type: 'checking',
  initialBalanceCents: 100000,
  color: '#123456',
  icon: 'bank',
  createdAt: '2026-11-12',
});
const category = (type = 'expense') => ({
  name: `QA ${type}`,
  type,
  color: '#123456',
  icon: 'tag',
});
const transaction = (accountId, categoryId, values = {}) => ({
  description: 'QA lançamento',
  type: 'expense',
  amountCents: 75000,
  categoryId,
  accountId,
  destinationAccountId: null,
  date: '2026-11-12',
  status: 'confirmed',
  notes: '',
  ...values,
});
async function create(entity, values, bearer = token) {
  const result = await api.request(bearer, 'POST', entity, undefined, values);
  expect(result.status).toBe(201);
  return result.body;
}
beforeAll(async () => {
  api = await createIntegrationHarness();
  owner = `qa-a-${randomUUID()}`;
  other = `qa-b-${randomUUID()}`;
  token = await api.signToken(owner);
  otherToken = await api.signToken(other);
});
afterAll(async () => {
  await api?.close();
});

describe('HTTP, JWT assinado e PostgreSQL reais', () => {
  it('nega acesso sem JWT, adulterado, expirado, emissor/audiência incorretos e sem expiração', async () => {
    const credentials = [
      null,
      'invalid',
      await api.signToken(owner, { expiry: -30 }),
      await api.signToken(owner, { issuer: 'https://wrong.test' }),
      await api.signToken(owner, { audience: 'https://wrong.test' }),
      await api.signToken(owner, { withoutExpiry: true }),
    ];
    for (const bearer of credentials) expect((await api.request(bearer)).status).toBe(401);
  });

  it('executa create/read/update/delete das quatro entidades, com confirmação SQL', async () => {
    const acc = await create('accounts', account());
    const cat = await create('categories', category());
    const rows = [
      [
        'transactions',
        await create('transactions', transaction(acc.id, cat.id)),
        { amountCents: 80000 },
      ],
      [
        'budgets',
        await create('budgets', { categoryId: cat.id, month: '2026-11', limitCents: 100000 }),
        { limitCents: 200000 },
      ],
      ['categories', cat, { name: 'QA categoria editada' }],
      ['accounts', acc, { initialBalanceCents: 110000 }],
    ];
    for (const [entity, row, changed] of rows) {
      const listed = await api.request(token, 'GET', entity);
      expect(listed.body.some((item) => item.id === row.id)).toBe(true);
      const result = await api.request(token, 'PATCH', entity, row.id, {
        ...changed,
        expectedRevision: row.revision,
      });
      expect(result.status).toBe(200);
      expect(result.body.revision).toBe(2);
      expect((await api.request(token, 'GET', entity, row.id)).body).toEqual(result.body);
      const stored = await api.pool.query(
        `SELECT revision FROM public.${entity} WHERE user_id=$1 AND id=$2`,
        [owner, row.id],
      );
      expect(stored.rows[0].revision).toBe(2);
      const removed = await api.request(token, 'DELETE', entity, row.id, { expectedRevision: 2 });
      expect(removed.status).toBe(200);
      expect((await api.request(token, 'GET', entity, row.id)).status).toBe(404);
      expect(
        (
          await api.pool.query(
            `SELECT count(*)::int AS n FROM public.${entity} WHERE user_id=$1 AND id=$2`,
            [owner, row.id],
          )
        ).rows[0].n,
      ).toBe(0);
    }
  });

  it('JWT válido exige sessão existente do mesmo usuário; ausência e substituição alheia são negadas', async () => {
    for (const sessionId of [null, 'invalid', randomUUID(), api.sessionIdFor(otherToken)])
      expect(
        (await api.request(token, 'GET', undefined, undefined, undefined, { sessionId })).status,
      ).toBe(401);
    expect((await api.request(token)).status).toBe(200);
  });

  it('sessão encerrada impede leitura e toda gravação com o JWT anterior, mesmo com outra sessão ativa', async () => {
    const user = 'qa-session-' + randomUUID();
    const old = await api.signToken(user),
      active = await api.signToken(user);
    const acc = await create('accounts', account('QA sessão encerrada'), old);
    await api.pool.query('DELETE FROM neon_auth.session WHERE id=$1', [api.sessionIdFor(old)]);
    const attempts = [
      ['GET', undefined, undefined, undefined],
      ['POST', 'accounts', undefined, account('QA não deve salvar')],
      ['PATCH', 'accounts', acc.id, { name: 'QA não deve editar', expectedRevision: 1 }],
      ['DELETE', 'accounts', acc.id, { expectedRevision: 1 }],
    ];
    for (const [method, entity, id, body] of attempts)
      expect((await api.request(old, method, entity, id, body)).status).toBe(401);
    expect((await api.request(active, 'GET', 'accounts')).body).toEqual([acc]);
    const newLogin = await api.signToken(user);
    expect((await api.request(newLogin)).status).toBe(200);
    expect((await api.request(old)).status).toBe(401);
  });

  it('sessão expirada recusa JWT ainda válido sem depender do relógio de expiração do JWT', async () => {
    const bearer = await api.signToken('qa-expiry-' + randomUUID());
    expect((await api.request(bearer)).status).toBe(200);
    await api.pool.query(
      'UPDATE neon_auth.session SET "expiresAt"=now()-interval \'1 second\' WHERE id=$1',
      [api.sessionIdFor(bearer)],
    );
    expect((await api.request(bearer)).status).toBe(401);
  });

  it('revogação global permanece efetiva contra pares JWT/sessão antigos após novo login', async () => {
    const user = 'qa-global-' + randomUUID();
    const first = await api.signToken(user),
      second = await api.signToken(user);
    await api.pool.query('DELETE FROM neon_auth.session WHERE "userId"=$1', [user]);
    expect((await api.request(first)).status).toBe(401);
    expect((await api.request(second)).status).toBe(401);
    expect((await api.request(await api.signToken(user))).status).toBe(200);
    expect((await api.request(first)).status).toBe(401);
  });

  it('role mínima executa a API sem ler Auth e falha fechada sem EXECUTE na função', async () => {
    const role = 'qa_runtime_' + randomUUID().replaceAll('-', '');
    const original = process.env.DATABASE_URL;
    const restricted = new URL(original);
    restricted.username = role;
    restricted.password = '';
    const runtime = new pg.Pool({ connectionString: restricted.href });
    await api.pool.query(
      `CREATE ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT`,
    );
    try {
      await api.pool.query(`GRANT CONNECT ON DATABASE saldolab_integration TO ${role}`);
      await api.pool.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
      await api.pool.query(
        `GRANT SELECT,INSERT,UPDATE,DELETE ON public.accounts,public.categories,public.transactions,public.budgets TO ${role}`,
      );
      await api.pool.query(
        `GRANT EXECUTE ON FUNCTION public.saldolab_session_active(text,uuid) TO ${role}`,
      );
      await expect(runtime.query('SELECT id FROM neon_auth.session')).rejects.toMatchObject({
        code: '42501',
      });
      await expect(runtime.query('SET ROLE postgres')).rejects.toMatchObject({ code: '42501' });
      const fn = await api.pool.query(
        "SELECT prosecdef, proconfig, has_function_privilege('public',oid,'EXECUTE') AS public_execute FROM pg_proc WHERE oid='public.saldolab_session_active(text,uuid)'::regprocedure",
      );
      expect(fn.rows[0]).toEqual({
        prosecdef: true,
        proconfig: ['search_path=pg_catalog'],
        public_execute: false,
      });
      process.env.DATABASE_URL = restricted.href;
      await closeDatabasePool();
      expect((await api.request(token)).status).toBe(200);
      const written = await create('accounts', account('QA role mínima'));
      await api.pool.query(
        `REVOKE EXECUTE ON FUNCTION public.saldolab_session_active(text,uuid) FROM ${role}`,
      );
      const failed = await api.request(
        token,
        'POST',
        'accounts',
        undefined,
        account('QA sem grant'),
      );
      expect(failed.status).toBe(500);
      expect(failed.body.error).not.toMatch(/permission|neon_auth|postgres|session_active/);
      expect(
        (await api.pool.query('SELECT name FROM public.accounts WHERE id=$1', [written.id])).rows[0]
          .name,
      ).toBe('QA role mínima');
      expect(
        (
          await api.pool.query(
            'SELECT count(*)::int AS n FROM public.accounts WHERE user_id=$1 AND name=$2',
            [owner, 'QA sem grant'],
          )
        ).rows[0].n,
      ).toBe(0);
    } finally {
      process.env.DATABASE_URL = original;
      await closeDatabasePool();
      await runtime.end();
      await api.pool.query(
        `REVOKE EXECUTE ON FUNCTION public.saldolab_session_active(text,uuid) FROM ${role}`,
      );
      await api.pool.query(
        `REVOKE SELECT,INSERT,UPDATE,DELETE ON public.accounts,public.categories,public.transactions,public.budgets FROM ${role}`,
      );
      await api.pool.query(`REVOKE USAGE ON SCHEMA public FROM ${role}`);
      await api.pool.query(`REVOKE CONNECT ON DATABASE saldolab_integration FROM ${role}`);
      await api.pool.query(`DROP ROLE ${role}`);
    }
  });

  it('isola listagem, GET por ID, edição, exclusão e referências entre usuários A/B', async () => {
    const a = await create('accounts', account('QA conta A'));
    const c = await create('categories', category());
    const tx = await create('transactions', transaction(a.id, c.id));
    const budget = await create('budgets', {
      categoryId: c.id,
      month: '2026-10',
      limitCents: 10000,
    });
    for (const [entity, row] of [
      ['accounts', a],
      ['categories', c],
      ['transactions', tx],
      ['budgets', budget],
    ]) {
      expect((await api.request(otherToken, 'GET', entity)).body).toEqual([]);
      for (const method of ['GET', 'PATCH', 'DELETE']) {
        const body =
          method === 'GET'
            ? undefined
            : method === 'PATCH'
              ? {
                  expectedRevision: row.revision,
                  ...(entity === 'accounts' || entity === 'categories'
                    ? { name: 'QA invasão' }
                    : entity === 'transactions'
                      ? { amountCents: 1 }
                      : { limitCents: 1 }),
                }
              : { expectedRevision: row.revision };
        expect((await api.request(otherToken, method, entity, row.id, body)).status).toBe(404);
      }
    }
    expect(
      (await api.request(otherToken, 'POST', 'transactions', undefined, transaction(a.id, c.id)))
        .status,
    ).toBe(422);
    expect(
      (
        await api.request(otherToken, 'POST', 'budgets', undefined, {
          categoryId: c.id,
          month: '2026-11',
          limitCents: 100,
        })
      ).status,
    ).toBe(422);
    expect((await api.request(token, 'GET', 'accounts', a.id)).body.initialBalanceCents).toBe(
      100000,
    );
  });

  it('rejeita referências cruzadas também nas FKs reais, sem depender da validação da API', async () => {
    const a = await create('accounts', account('QA FK A'));
    await expect(
      api.pool.query(
        "INSERT INTO public.transactions(id,user_id,description,type,amount_cents,account_id,destination_account_id,date,status) VALUES($1,$2,'QA FK','transfer',100,$3,$4,'2026-11-12','confirmed')",
        [randomUUID(), other, a.id, randomUUID()],
      ),
    ).rejects.toMatchObject({ code: '23503' });
  });

  it('rejeita valores fracionários/fora do limite, datas inválidas, duplicatas e exclusão em uso sem salvar', async () => {
    const acc = await create('accounts', account('QA validação'));
    const cat = await create('categories', category());
    for (const amountCents of [0, -1, 1.5, 100000000001]) {
      expect(
        (
          await api.request(
            token,
            'POST',
            'transactions',
            undefined,
            transaction(acc.id, cat.id, { amountCents }),
          )
        ).status,
      ).toBe(422);
    }
    expect(
      (
        await api.request(
          token,
          'POST',
          'transactions',
          undefined,
          transaction(acc.id, cat.id, { date: '2026-02-30' }),
        )
      ).status,
    ).toBe(422);
    expect(
      (
        await api.request(
          token,
          'POST',
          'transactions',
          undefined,
          transaction(acc.id, cat.id, { type: 'income' }),
        )
      ).status,
    ).toBe(422);
    expect(
      (await api.request(token, 'POST', 'accounts', undefined, { ...account(), user_id: other }))
        .status,
    ).toBe(422);
    await create('transactions', transaction(acc.id, cat.id));
    await create('budgets', { categoryId: cat.id, month: '2026-11', limitCents: 10000 });
    expect(
      (
        await api.request(token, 'POST', 'budgets', undefined, {
          categoryId: cat.id,
          month: '2026-11',
          limitCents: 20000,
        })
      ).status,
    ).toBe(409);
    expect(
      (await api.request(token, 'DELETE', 'accounts', acc.id, { expectedRevision: 1 })).status,
    ).toBe(409);
    expect(
      (await api.request(token, 'DELETE', 'categories', cat.id, { expectedRevision: 1 })).status,
    ).toBe(409);
    expect(
      (
        await api.pool.query(
          'SELECT count(*)::int AS n FROM public.transactions WHERE user_id=$1 AND account_id=$2',
          [owner, acc.id],
        )
      ).rows[0].n,
    ).toBe(1);
    expect(
      (
        await api.pool.query(
          'SELECT count(*)::int AS n FROM public.budgets WHERE user_id=$1 AND category_id=$2',
          [owner, cat.id],
        )
      ).rows[0].n,
    ).toBe(1);
  });

  it.each([
    ['23514', 422, 'Os dados não atendem às regras financeiras.'],
    ['XX000', 500, 'Não foi possível concluir a operação. Tente novamente.'],
  ])(
    'falha real %s no COMMIT não retorna sucesso e desfaz o INSERT',
    async (code, status, message) => {
      const name = 'qa_commit_' + randomUUID().replaceAll('-', '');
      const client = await api.pool.connect();
      try {
        // A deferred trigger fails after INSERT RETURNING, exactly at COMMIT.
        // It applies only to this synthetic owner and sentinel record.
        await client.query(
          `CREATE FUNCTION public.${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'QA deferred commit failure' USING ERRCODE='${code}'; END $$`,
        );
        await client.query(
          `CREATE CONSTRAINT TRIGGER ${name} AFTER INSERT ON public.accounts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (NEW.user_id='${owner}' AND NEW.name='QA reject commit') EXECUTE FUNCTION public.${name}()`,
        );
        const result = await api.request(
          token,
          'POST',
          'accounts',
          undefined,
          account('QA reject commit'),
        );
        expect(result.status).toBe(status);
        expect(result.body).toEqual({ error: message });
        expect(
          (
            await client.query(
              "SELECT count(*)::int AS n FROM public.accounts WHERE user_id=$1 AND name='QA reject commit'",
              [owner],
            )
          ).rows[0].n,
        ).toBe(0);
      } finally {
        await client.query(`DROP TRIGGER IF EXISTS ${name} ON public.accounts`);
        await client.query(`DROP FUNCTION IF EXISTS public.${name}()`);
        client.release();
      }
    },
  );

  it.each(['accounts', 'categories', 'transactions', 'budgets'])(
    'preserva revisão e conteúdo no conflito simultâneo de %s',
    async (entity) => {
      const acc = await create('accounts', account('QA revisão'));
      const cat = await create('categories', category());
      const row =
        entity === 'accounts'
          ? acc
          : entity === 'categories'
            ? cat
            : entity === 'transactions'
              ? await create(entity, transaction(acc.id, cat.id))
              : await create(entity, { categoryId: cat.id, month: '2026-09', limitCents: 10000 });
      const changed = (value) =>
        entity === 'accounts' || entity === 'categories'
          ? { name: 'QA revisão ' + value }
          : entity === 'transactions'
            ? { amountCents: value }
            : { limitCents: value };
      const results = await Promise.all(
        [12345, 67890].map((value) =>
          api.request(token, 'PATCH', entity, row.id, { ...changed(value), expectedRevision: 1 }),
        ),
      );
      expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
      const saved = await api.request(token, 'GET', entity, row.id);
      expect(saved.body).toEqual(results.find((result) => result.status === 200).body);
      expect(
        (await api.request(token, 'DELETE', entity, row.id, { expectedRevision: 1 })).status,
      ).toBe(409);
    },
  );

  it('duas edições simultâneas produzem 200/409 e a exclusão antiga não apaga a edição recente', async () => {
    const row = await create('accounts', account('QA concorrência'));
    const results = await Promise.all(
      [250000, 300000].map((initialBalanceCents) =>
        api.request(token, 'PATCH', 'accounts', row.id, {
          initialBalanceCents,
          expectedRevision: 1,
        }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const saved = await api.request(token, 'GET', 'accounts', row.id);
    expect(saved.body.initialBalanceCents).toBe(
      results.find((r) => r.status === 200).body.initialBalanceCents,
    );
    expect(saved.body.revision).toBe(2);
    expect(
      (await api.request(token, 'DELETE', 'accounts', row.id, { expectedRevision: 1 })).status,
    ).toBe(409);
    expect((await api.request(token, 'GET', 'accounts', row.id)).body).toEqual(saved.body);
  });

  it('calcula centavos, saldo, pendências, transferências e orçamento a partir do snapshot SQL', async () => {
    const financialOwner = `qa-finance-${randomUUID()}`;
    const bearer = await api.signToken(financialOwner);
    const current = await create('accounts', account(), bearer);
    const reserve = await create(
      'accounts',
      { ...account('QA reserva'), initialBalanceCents: 0 },
      bearer,
    );
    const income = await create('categories', category('income'), bearer);
    const expense = await create('categories', category(), bearer);
    await create(
      'transactions',
      transaction(current.id, income.id, { type: 'income', amountCents: 250000 }),
      bearer,
    );
    await create('transactions', transaction(current.id, expense.id), bearer);
    await create(
      'transactions',
      transaction(current.id, expense.id, { status: 'pending', amountCents: 12345 }),
      bearer,
    );
    await create(
      'transactions',
      transaction(current.id, null, {
        type: 'transfer',
        destinationAccountId: reserve.id,
        amountCents: 20000,
      }),
      bearer,
    );
    const budget = await create(
      'budgets',
      { categoryId: expense.id, month: '2026-11', limitCents: 100000 },
      bearer,
    );
    const snap = (await api.request(bearer)).body;
    expect(totalBalance(snap.accounts, snap.transactions)).toBe(275000);
    expect(accountBalance(current, snap.transactions)).toBe(255000);
    expect(accountBalance(reserve, snap.transactions)).toBe(20000);
    expect(totals(snap.transactions)).toMatchObject({
      income: 250000,
      expense: 75000,
      net: 175000,
    });
    expect(budgetProgress(budget, snap.transactions)).toMatchObject({ spent: 75000, percent: 75 });
    expect(
      snap.transactions.every(
        (row) => Number.isInteger(row.amountCents) && row.date === '2026-11-12',
      ),
    ).toBe(true);
  });

  it('mantém a semântica da categoria durante cadastro concorrente e mudança de tipo', async () => {
    const acc = await create('accounts', account('QA corrida de vínculo'));
    const cat = await create('categories', category('income'));
    const client = await api.pool.connect();
    let pending;
    let observing = true;
    let releaseInsert;
    const insertGate = new Promise((resolve) => {
      releaseInsert = resolve;
    });
    let reachedInsert;
    const beforeInsert = new Promise((resolve) => {
      reachedInsert = resolve;
    });
    let creating;
    try {
      await client.query('BEGIN');
      // Pause immediately before INSERT; every query still reaches PostgreSQL.
      // This exposes the gap between reference validation and FK acquisition.
      creating = createRecord(
        {
          query: async (sql, args) => {
            if (sql.startsWith('INSERT INTO public.transactions')) {
              reachedInsert();
              await insertGate;
            }
            return client.query(sql, args);
          },
        },
        'transactions',
        owner,
        transaction(acc.id, cat.id, { type: 'income' }),
      );
      await beforeInsert;
      pending = api.request(token, 'PATCH', 'categories', cat.id, {
        type: 'expense',
        expectedRevision: 1,
      });
      const waitForLock = async () => {
        const deadline = Date.now() + 5000;
        while (observing && Date.now() < deadline) {
          const waiting = await api.pool.query(
            "SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='saldolab-api' AND wait_event_type='Lock') AS blocked",
          );
          if (waiting.rows[0].blocked) return true;
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        return false;
      };
      const first = await Promise.race([
        pending.then((result) => ({ early: result.status })),
        waitForLock().then((blocked) => ({ blocked })),
      ]);
      observing = false;
      releaseInsert();
      await creating;
      await client.query('COMMIT');
      const result = await pending;
      expect(first).toEqual({ blocked: true });
      expect(result.status).toBe(409);
      expect((await api.request(token, 'GET', 'categories', cat.id)).body.type).toBe('income');
    } finally {
      observing = false;
      releaseInsert();
      await creating;
      await client.query('ROLLBACK');
      client.release();
      await pending;
    }
  });

  it('diferencia indisponibilidade real do JWKS de sessão inválida sem expor detalhes', async () => {
    const previous = process.env.NEON_AUTH_JWKS_URL;
    api.setIssuerAvailable(false);
    process.env.NEON_AUTH_JWKS_URL = previous + '?unavailable';
    try {
      const result = await api.request(token);
      expect(result.status).toBe(503);
      expect(result.body).toEqual({
        error: 'Não foi possível verificar sua sessão. Tente novamente.',
      });
    } finally {
      api.setIssuerAvailable(true);
      process.env.NEON_AUTH_JWKS_URL = previous;
    }
  });

  it('recupera o pool após o PostgreSQL encerrar uma conexão ociosa da API', async () => {
    expect((await api.request(token)).status).toBe(200);
    const terminated = await api.pool.query(
      "SELECT pg_terminate_backend(pid) AS ended FROM pg_stat_activity WHERE application_name='saldolab-api' AND state='idle' AND datname=current_database()",
    );
    expect(terminated.rows.some((row) => row.ended)).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect((await api.request(token)).status).toBe(200);
  });
});

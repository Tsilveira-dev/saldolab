import { test, expect } from '@playwright/test';

const data = () => ({
  version: 1,
  accounts: [
    {
      id: 'a',
      name: 'QA conta',
      type: 'checking',
      initialBalanceCents: 0,
      color: '#123456',
      icon: 'bank',
      createdAt: '2026-11-01',
    },
  ],
  categories: [{ id: 'c', name: 'QA receita', type: 'income', color: '#40876c', icon: 'tag' }],
  transactions: [
    {
      id: 't',
      description: 'QA receita concorrente',
      type: 'income',
      amountCents: 100000,
      categoryId: 'c',
      accountId: 'a',
      destinationAccountId: null,
      date: '2026-11-11',
      status: 'confirmed',
      notes: '',
    },
  ],
  budgets: [],
});
async function prepare(page) {
  await page.clock.setFixedTime(new Date('2026-11-11T15:00:00Z'));
  await page.addInitScript((data) => {
    if (!localStorage.getItem('saldolab:v1:personal'))
      localStorage.setItem('saldolab:v1:personal', JSON.stringify(data));
    localStorage.setItem(
      'saldolab:preferences:v1',
      JSON.stringify({ mode: 'personal', theme: 'light' }),
    );
  }, data());
  await page.goto('/transacoes');
}
const stored = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('saldolab:v1:personal')).transactions);

test('três abas preservam gravações confirmadas e recusam escritores concorrentes', async ({
  context,
}) => {
  test.skip(
    Boolean(process.env.BASE_URL),
    'A prova do repositório importa o módulo no servidor Vite local; os fluxos de UI usam o build.',
  );
  const pages = await Promise.all(Array.from({ length: 3 }, () => context.newPage()));
  await Promise.all(pages.map((page) => page.goto('http://localhost:5174/favicon.svg')));
  const seed = data();
  seed.transactions = Array.from({ length: 3000 }, (_, i) => ({
    ...seed.transactions[0],
    id: `seed-${i}`,
    amountCents: 1,
  }));
  await pages[0].evaluate(
    (seed) => localStorage.setItem('saldolab:v1:personal', JSON.stringify(seed)),
    seed,
  );
  await Promise.all(
    pages.map((page) =>
      page.evaluate(async () => {
        const { createLocalRepository } = await import('/src/repositories/localRepository.js');
        window.qaRepository = createLocalRepository({ mode: 'personal' });
      }),
    ),
  );
  const batches = await Promise.all(
    pages.map((page, tab) =>
      page.evaluate(
        async ({ tab, template }) => {
          const results = [];
          for (let i = 0; i < 20; i++) {
            try {
              await window.qaRepository.create('transactions', {
                ...template,
                id: `tab-${tab}-${i}`,
                amountCents: 1,
              });
              results.push({ ok: true });
            } catch (error) {
              results.push({ ok: false, message: error.message });
            }
          }
          return results;
        },
        { tab, template: data().transactions[0] },
      ),
    ),
  );
  const results = batches.flat();
  const successful = results.filter((result) => result.ok).length;
  expect(successful).toBe(20);
  expect(results.filter((result) => !result.ok)).toHaveLength(40);
  expect(
    results.filter((result) => !result.ok).every((result) => result.message.includes('outra aba')),
  ).toBe(true);
  const observer = await context.newPage();
  await observer.goto('http://localhost:5174/favicon.svg');
  const transactions = await stored(observer);
  expect(transactions).toHaveLength(3000 + successful);
  expect(transactions.reduce((sum, tx) => sum + tx.amountCents, 0)).toBe(3000 + successful);
});

test('editar um formulário antigo não desfaz o valor salvo em outra aba', async ({
  page,
  context,
}) => {
  await prepare(page);
  const second = await context.newPage();
  await second.clock.setFixedTime(new Date('2026-11-11T15:00:00Z'));
  await second.goto('/transacoes');
  for (const tab of [page, second])
    await tab.getByRole('button', { name: 'Editar QA receita concorrente', exact: true }).click();
  await page.getByRole('dialog').locator('[name=amount]').fill('2500,00');
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await second.getByRole('dialog').locator('[name=description]').fill('QA formulário antigo');
  await second.getByRole('dialog').getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(second.getByRole('dialog').getByRole('alert')).toContainText('outra aba');
  expect((await stored(second))[0]).toMatchObject({
    amountCents: 250000,
    description: 'QA receita concorrente',
  });
  await second.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
  await page.close();
  await second.reload();
  await second.getByRole('button', { name: 'Editar QA receita concorrente', exact: true }).click();
  await second.getByRole('dialog').locator('[name=amount]').fill('3000,00');
  await second.getByRole('dialog').getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(second.getByRole('dialog')).toHaveCount(0);
  expect((await stored(second))[0].amountCents).toBe(300000);
});

test('uma confirmação de exclusão antiga não remove a edição de outra aba', async ({
  page,
  context,
}) => {
  const second = await context.newPage();
  await prepare(second);
  await page.clock.setFixedTime(new Date('2026-11-11T15:00:00Z'));
  await page.goto('/transacoes');
  await page.getByRole('button', { name: 'Excluir QA receita concorrente', exact: true }).click();
  await second.getByRole('button', { name: 'Editar QA receita concorrente', exact: true }).click();
  await second.getByRole('dialog').locator('[name=amount]').fill('2500,00');
  await second.getByRole('dialog').getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(second.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('dialog').getByRole('button', { name: 'Excluir registro' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('outra aba');
  expect(await stored(page)).toHaveLength(1);
  expect((await stored(page))[0].amountCents).toBe(250000);
});

test('sem Web Locks, preserva dados existentes e recusa edição sem proteção', async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined }),
  );
  await prepare(page);
  const before = await stored(page);
  await page.getByRole('button', { name: 'Editar QA receita concorrente', exact: true }).click();
  await page.getByRole('dialog').locator('[name=amount]').fill('3000,00');
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('edição segura');
  expect(await stored(page)).toEqual(before);
});

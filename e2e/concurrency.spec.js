import { test, expect } from '@playwright/test';
import { activateEditing, setFinancialTime } from './helpers';

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
async function prepare(page, editing = true) {
  await setFinancialTime(page, '2026-11-11T15:00:00Z');
  await page.addInitScript((data) => {
    if (!localStorage.getItem('saldolab:v1:personal'))
      localStorage.setItem('saldolab:v1:personal', JSON.stringify(data));
    localStorage.setItem(
      'saldolab:preferences:v1',
      JSON.stringify({ mode: 'personal', theme: 'light' }),
    );
  }, data());
  await page.goto('/transacoes');
  if (editing) await activateEditing(page);
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
        await window.qaRepository.startEditing();
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

test('uma aba de consulta não bloqueia a editora e assume edição após ela fechar', async ({
  page,
  context,
}) => {
  await prepare(page, false);
  expect((await page.evaluate(() => navigator.locks.query())).held).toEqual([]);
  await expect(
    page.getByRole('button', { name: 'Editar QA receita concorrente', exact: true }),
  ).toBeDisabled();
  const second = await context.newPage();
  await prepare(second);
  await second.getByRole('button', { name: 'Editar QA receita concorrente', exact: true }).click();
  await second.getByRole('dialog').locator('[name=amount]').fill('2500,00');
  await second.getByRole('dialog').getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(second.getByRole('dialog')).toHaveCount(0);
  await expect.poll(async () => (await stored(page))[0].amountCents).toBe(250000);
  await second.close();
  await expect
    .poll(async () => (await page.evaluate(() => navigator.locks.query())).held.length)
    .toBe(0);
  await activateEditing(page);
  await page.getByRole('button', { name: 'Editar QA receita concorrente', exact: true }).click();
  await page.getByRole('dialog').locator('[name=amount]').fill('3000,00');
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await stored(page))[0].amountCents).toBe(300000);
});

test('outra editora mantém a aba em consulta, sem sucesso falso nem importação ou limpeza', async ({
  page,
  context,
}) => {
  const writer = await context.newPage();
  await prepare(writer);
  await prepare(page, false);
  await page.getByRole('button', { name: 'Ativar edição', exact: true }).click();
  const notice = page.getByRole('region', { name: 'Permissão de edição' });
  await expect(notice).toContainText('outra aba');
  await expect(page.getByRole('button', { name: 'Nova transação', exact: true })).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Editar QA receita concorrente', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Excluir QA receita concorrente', exact: true }),
  ).toBeDisabled();
  await page.goto('/configuracoes');
  await expect(page.getByRole('button', { name: 'Importar backup', exact: true })).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Apagar dados pessoais', exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel('Arquivo de backup JSON')).toBeDisabled();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar backup JSON' }).click();
  expect((await download).suggestedFilename()).toBe('saldolab-personal-backup.json');
  expect((await stored(page))[0].amountCents).toBe(100000);
});

test('sem Web Locks, avisa somente leitura e desabilita edição preservando os dados', async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined }),
  );
  await prepare(page, false);
  await expect(page.getByRole('region', { name: 'Permissão de edição' })).toContainText(
    'não permite alterações seguras',
  );
  await expect(page.getByRole('button', { name: 'Ativar edição', exact: true })).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Editar QA receita concorrente', exact: true }),
  ).toBeDisabled();
  expect((await stored(page))[0].amountCents).toBe(100000);
});

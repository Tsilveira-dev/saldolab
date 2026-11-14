import { test, expect } from '@playwright/test';
import { activateEditing, setFinancialTime } from './helpers';
import { createDemoData } from '../src/services/demo';

test.beforeEach(async ({ page }) => {
  await setFinancialTime(page, '2026-11-11T15:00:00Z');
  const seed = createDemoData('2026-11');
  await page.addInitScript(
    (data) => {
      if (!localStorage.getItem('saldolab:v1:personal'))
        localStorage.setItem('saldolab:v1:personal', JSON.stringify(data));
      localStorage.setItem(
        'saldolab:preferences:v1',
        JSON.stringify({ mode: 'personal', theme: 'light' }),
      );
    },
    seed,
  );
});

const editors = (page) =>
  page.evaluate(async () =>
    (await navigator.locks.query()).held.filter((lock) => lock.name.endsWith(':editor')),
  );

async function open(page, route = '/') {
  await page.goto(route);
  await expect(page.locator('main h1')).toBeVisible();
}

async function addExpense(page, description) {
  await page.getByRole('button', { name: 'Nova transação', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('[name=description]').fill(description);
  await dialog.locator('[name=amount]').fill('42,00');
  await dialog.locator('[name=categoryId]').selectOption('food');
  await dialog.getByRole('button', { name: 'Adicionar registro' }).click();
  await expect(dialog).toHaveCount(0);
}

test('a primeira aba edita automaticamente e bloqueia as demais', async ({
  page,
  context,
}) => {
  await open(page);
  await activateEditing(page);
  const first = await editors(page);
  expect(first).toHaveLength(1);
  await expect(page.getByRole('button', { name: 'Ativar edição' })).toHaveCount(0);
  const second = await context.newPage();
  await open(second);
  await expect(
    second.getByRole('button', { name: 'Nova transação', exact: true }),
  ).toBeDisabled();
  await expect(
    second.getByRole('region', { name: 'Estado das alterações' }),
  ).toContainText('Outra aba');
  expect((await editors(second))[0].clientId).toBe(first[0].clientId);
});

test('recarregar retoma a edição com lock novo sem apagar transações', async ({ page }) => {
  await open(page);
  await activateEditing(page);
  const before = await editors(page);
  await addExpense(page, 'QA edição após recarga');
  await page.reload();
  await activateEditing(page);
  const after = await editors(page);
  expect(after).toHaveLength(1);
  expect(after[0].clientId).not.toBe(before[0].clientId);
  await expect(page.getByText('QA edição após recarga', { exact: true })).toBeVisible();
});

test('navegar por páginas não perde nem multiplica a reserva', async ({ page }) => {
  await open(page);
  await activateEditing(page);
  const initial = await editors(page);
  await page.getByRole('link', { name: 'Contas', exact: true }).click();
  await page.getByRole('link', { name: 'Categorias', exact: true }).click();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Um lugar para cada conta.' })).toBeVisible();
  expect(await editors(page)).toEqual(initial);
});

test('uma aba bloqueada assume a edição após fechar a primeira e recarregar', async ({
  page,
  context,
}) => {
  await open(page);
  await activateEditing(page);
  const second = await context.newPage();
  await open(second);
  await expect(second.getByRole('button', { name: 'Nova transação' })).toBeDisabled();
  await addExpense(page, 'QA salvo pela primeira aba');
  await page.close();
  await expect.poll(async () => (await editors(second)).length).toBe(0);
  await second.reload();
  await activateEditing(second);
  await expect(second.getByText('QA salvo pela primeira aba', { exact: true })).toBeVisible();
  await addExpense(second, 'QA salvo pela segunda aba');
  const rows = await second.evaluate(
    () => JSON.parse(localStorage.getItem('saldolab:v1:personal')).transactions,
  );
  expect(rows.filter((tx) => tx.description.startsWith('QA salvo pela'))).toHaveLength(2);
});

test('sem Web Locks, bloqueia gravação mas mantém consulta e backup', async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined }),
  );
  await open(page);
  await expect(page.getByRole('region', { name: 'Estado das alterações' })).toContainText(
    'navegador atualizado',
  );
  await expect(page.getByRole('button', { name: 'Nova transação' })).toBeDisabled();
  await page.goto('/configuracoes');
  await expect(page.getByRole('button', { name: 'Importar backup' })).toBeDisabled();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar backup JSON' }).click();
  expect((await download).suggestedFilename()).toBe('saldolab-personal-backup.json');
});

test('gravação sem efeito não confirma sucesso nem altera os dados', async ({ page }) => {
  await open(page);
  await activateEditing(page);
  const before = await page.evaluate(() => localStorage.getItem('saldolab:v1:personal'));
  await page.evaluate(() => {
    window.qaOriginalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'saldolab:v1:personal') return;
      return window.qaOriginalSetItem.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: 'Nova transação' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('[name=description]').fill('QA tentativa bloqueada');
  await dialog.locator('[name=amount]').fill('42,00');
  await dialog.locator('[name=categoryId]').selectOption('food');
  await dialog.getByRole('button', { name: 'Adicionar registro' }).click();
  await expect(dialog.getByRole('alert')).toContainText('confirmar a gravação');
  expect(await page.evaluate(() => localStorage.getItem('saldolab:v1:personal'))).toBe(before);
  await page.evaluate(() => {
    Storage.prototype.setItem = window.qaOriginalSetItem;
  });
  await dialog.getByRole('button', { name: 'Adicionar registro' }).click();
  await expect(dialog).toHaveCount(0);
  const rows = await page.evaluate(
    () => JSON.parse(localStorage.getItem('saldolab:v1:personal')).transactions,
  );
  expect(rows.filter((tx) => tx.description === 'QA tentativa bloqueada')).toHaveLength(1);
});

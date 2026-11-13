import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { activateEditing, setFinancialTime } from './helpers';

// Playwright disables BFCache by default; use the real cached-document path here.
test.use({
  // The default headless shell does not restore BFCache documents in CI.
  // Use the full Chromium binary with its new headless mode instead.
  channel: 'chromium',
  launchOptions: {
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}),
    ignoreDefaultArgs: ['--disable-back-forward-cache'],
  },
});

const notice = (page) => page.getByRole('region', { name: 'Permissão de edição' });
const editors = (page) =>
  page.evaluate(async () =>
    (await navigator.locks.query()).held.filter((lock) => lock.name.endsWith(':editor')),
  );
async function open(page, path = '/') {
  await setFinancialTime(page, '2026-11-11T15:00:00Z');
  await page.goto(path);
  await expect(page.locator('main h1')).toBeVisible();
}
async function nav(page, name) {
  const menu = page.getByRole('button', { name: 'Abrir menu', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('link', { name, exact: true }).click();
}
async function addExpense(page, description = 'QA ciclo de edição') {
  await page.getByRole('button', { name: 'Nova transação', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('[name=description]').fill(description);
  await dialog.locator('[name=amount]').fill('42,00');
  await dialog.locator('[name=categoryId]').selectOption('food');
  await dialog.getByRole('button', { name: 'Adicionar registro', exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

test('todas as operações financeiras ficam desabilitadas em consulta; navegação e backup permanecem disponíveis', async ({
  page,
}, info) => {
  await open(page);
  await expect(notice(page)).toContainText('Somente leitura');
  expect(await editors(page)).toEqual([]);
  await expect(page.getByRole('button', { name: 'Nova transação', exact: true })).toBeDisabled();
  await expect(page.locator('button[aria-label="Adicionar transação"]')).toBeDisabled();
  for (const [route, create] of [
    ['/transacoes', 'Nova transação'],
    ['/contas', 'Adicionar conta'],
    ['/categorias', 'Nova categoria'],
    ['/orcamentos', 'Novo orçamento'],
  ]) {
    await page.goto(route);
    await expect(page.getByRole('button', { name: create, exact: true })).toBeDisabled();
    const actions = page.getByRole('button', { name: /^(Editar |Excluir )/ });
    expect(await actions.count()).toBeGreaterThan(0);
    for (const action of await actions.all()) await expect(action).toBeDisabled();
  }
  await page.goto('/configuracoes');
  for (const name of ['Importar backup', 'Restaurar demonstração'])
    await expect(page.getByRole('button', { name, exact: true })).toBeDisabled();
  await expect(page.getByLabel('Arquivo de backup JSON')).toBeDisabled();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar backup JSON' }).click();
  expect((await pending).suggestedFilename()).toBe('saldolab-demo-backup.json');
  expect(await editors(page)).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('saldolab:v1:demo'))).toBeNull();
  await page.goto('/relatorios');
  await expect(page.getByRole('button', { name: 'Exportar CSV', exact: true })).toBeEnabled();
  await page.screenshot({
    path: info.outputPath('somente-leitura.png'),
    fullPage: true,
    animations: 'disabled',
  });
});

test('recarregar a editora libera a reserva antiga, retoma a edição e preserva gravações', async ({
  page,
  context,
}) => {
  await open(page);
  await page.locator('input[type=month]').fill('2026-10');
  await page.getByRole('combobox', { name: /^Filtrar por conta/ }).selectOption('checking');
  await activateEditing(page);
  await expect(page.locator('input[type=month]')).toHaveValue('2026-10');
  await expect(page.getByRole('combobox', { name: /^Filtrar por conta/ })).toHaveValue('checking');
  await page.locator('input[type=month]').fill('2026-11');
  await addExpense(page);
  const before = await editors(page);
  await page.reload();
  await expect(notice(page)).toContainText('Edição ativa nesta aba');
  const after = await editors(page);
  expect(after).toHaveLength(1);
  expect(after[0].clientId).not.toBe(before[0].clientId);
  await expect(page.getByText('QA ciclo de edição', { exact: true })).toBeVisible();
  const reader = await context.newPage();
  await open(reader);
  await reader.reload();
  await expect(notice(reader)).toContainText('Somente leitura');
  expect((await editors(reader))[0].clientId).toBe(after[0].clientId);
});

test('navegação SPA e Voltar mantêm a mesma editora, sem duplicar reservas', async ({ page }) => {
  await open(page);
  await activateEditing(page);
  const original = await editors(page);
  await nav(page, 'Contas');
  await nav(page, 'Categorias');
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Um lugar para cada conta.' })).toBeVisible();
  await expect(notice(page)).toContainText('Edição ativa nesta aba');
  expect(await editors(page)).toEqual(original);
});

test('encerrar edição libera outra aba; reativação atualiza os dados antes de gravar', async ({
  page,
  context,
}) => {
  await open(page);
  await activateEditing(page);
  const second = await context.newPage();
  await open(second);
  await page.getByRole('button', { name: 'Encerrar edição', exact: true }).click();
  await expect.poll(async () => (await editors(second)).length).toBe(0);
  await page.reload();
  await expect(notice(page)).toContainText('Somente leitura');
  expect(await editors(page)).toEqual([]);
  await activateEditing(second);
  await addExpense(second, 'QA segunda editora');
  await second.getByRole('button', { name: 'Encerrar edição', exact: true }).click();
  await activateEditing(page);
  await expect(page.getByText('QA segunda editora', { exact: true })).toBeVisible();
  await addExpense(page, 'QA terceira gravação');
  const observer = await context.newPage();
  await open(observer);
  const rows = await observer.evaluate(
    () => JSON.parse(localStorage.getItem('saldolab:v1:demo')).transactions,
  );
  expect(
    rows.filter((tx) => ['QA segunda editora', 'QA terceira gravação'].includes(tx.description)),
  ).toHaveLength(2);
});

test('trocar de modo libera o anterior e não reserva edição no modo consultado', async ({
  page,
  context,
}) => {
  await open(page);
  await activateEditing(page);
  await nav(page, 'Configurações');
  await page.getByRole('radio', { name: /Neste aparelho/ }).check();
  await nav(page, 'Dashboard');
  await expect(notice(page)).toContainText('Somente leitura');
  await expect.poll(async () => (await editors(page)).length).toBe(0);
  const other = await context.newPage();
  await open(other);
  await nav(other, 'Configurações');
  await other.getByRole('radio', { name: /Exemplo para explorar/ }).check();
  await nav(other, 'Dashboard');
  await activateEditing(other);
  await expect(other.getByRole('button', { name: 'Nova transação', exact: true })).toBeEnabled();
  expect((await editors(page)).map((lock) => lock.name)).toEqual(['saldolab:v1:demo:editor']);
  await expect(page.getByRole('button', { name: 'Nova transação', exact: true })).toBeDisabled();
});

test('fechar a consulta preserva a editora; fechar a editora libera quem está consultando', async ({
  page,
  context,
}) => {
  await open(page);
  const writer = await context.newPage();
  await open(writer);
  await activateEditing(writer);
  const held = await editors(writer);
  const reader = await context.newPage();
  await open(reader);
  await page.close();
  expect(await editors(writer)).toEqual(held);
  await addExpense(writer, 'QA após fechar consulta');
  await writer.close();
  await expect.poll(async () => (await editors(reader)).length).toBe(0);
  await activateEditing(reader);
  await expect(reader.getByText('QA após fechar consulta', { exact: true })).toBeVisible();
});

test('bloqueio do estado de navegação mantém consulta e avisa sem conceder edição', async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'saldolab:editing-request:v1')
        throw new DOMException('QA blocked', 'SecurityError');
      return original.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: 'Ativar edição', exact: true }).click();
  await expect(page.getByText(/Não foi possível ativar a edição/)).toBeVisible();
  await expect(notice(page)).toContainText('Somente leitura');
  await expect(page.getByRole('button', { name: 'Nova transação', exact: true })).toBeDisabled();
  expect(await editors(page)).toEqual([]);
});

test('aba aberta pela editora não herda a permissão nem a retoma ao atualizar', async ({
  page,
  context,
}) => {
  await open(page);
  await activateEditing(page);
  const popupReady = context.waitForEvent('page');
  await page.evaluate(() => window.open('/', '_blank'));
  const popup = await popupReady;
  await expect(notice(popup)).toContainText('Somente leitura');
  expect(
    await popup.evaluate(() => sessionStorage.getItem('saldolab:editing-request:v1')),
  ).toBeNull();
  await page.getByRole('button', { name: 'Encerrar edição', exact: true }).click();
  await popup.reload();
  await expect(notice(popup)).toContainText('Somente leitura');
  expect(await editors(popup)).toEqual([]);
  await activateEditing(popup);
});

test('setItem sem efeito mantém o formulário com erro e não anuncia sucesso', async ({
  page,
  context,
}) => {
  await open(page);
  await activateEditing(page);
  const before = await page.evaluate(() => localStorage.getItem('saldolab:v1:demo'));
  await page.evaluate(() => {
    window.qaSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'saldolab:v1:demo') return;
      return window.qaSetItem.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: 'Nova transação', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('[name=description]').fill('QA sem sucesso falso');
  await dialog.locator('[name=amount]').fill('42,00');
  await dialog.locator('[name=categoryId]').selectOption('food');
  await dialog.getByRole('button', { name: 'Adicionar registro', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('confirmar a gravação');
  await expect(page.getByText('Alterações salvas.', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('saldolab:v1:demo'))).toBe(before);
  await page.evaluate(() => {
    Storage.prototype.setItem = window.qaSetItem;
  });
  await dialog.getByRole('button', { name: 'Adicionar registro', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const observer = await context.newPage();
  await open(observer);
  const rows = await observer.evaluate(
    () => JSON.parse(localStorage.getItem('saldolab:v1:demo')).transactions,
  );
  expect(rows.filter((tx) => tx.description === 'QA sem sucesso falso')).toHaveLength(1);
});

test.describe('histórico com BFCache habilitado', () => {
  for (const editing of [false, true]) {
    test(`sair e Voltar: ${editing ? 'editora libera o lock' : 'consulta recupera dados atuais'} sem retomar permissão antiga`, async ({
      page,
      context,
    }, info) => {
      await page.addInitScript(() => {
        window.qaLifecycle = { id: crypto.randomUUID(), restored: false };
        window.addEventListener('pageshow', (event) => {
          window.qaLifecycle.restored = event.persisted;
        });
      });
      await open(page);
      if (editing) await activateEditing(page);
      const id = await page.evaluate(() => window.qaLifecycle.id);
      await page.evaluate(() => document.fonts.ready);
      await page.goto('/favicon.svg');
      const second = await context.newPage();
      await open(second);
      await expect.poll(async () => (await editors(second)).length).toBe(0);
      await activateEditing(second);
      await addExpense(second, 'QA durante ausência');
      await page.goBack({ waitUntil: 'commit' });
      await expect(notice(page)).toContainText('Somente leitura');
      await expect(
        page.getByRole('button', { name: 'Nova transação', exact: true }),
      ).toBeDisabled();
      await expect(page.getByText('QA durante ausência', { exact: true })).toBeVisible();
      const lifecycle = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0];
        return {
          ...window.qaLifecycle,
          navigationType: navigation?.type,
          notRestoredReasons: navigation?.notRestoredReasons?.toJSON?.() ?? null,
        };
      });
      const evidencePath = info.outputPath('lifecycle.json');
      await writeFile(
        evidencePath,
        JSON.stringify({ editing, id_before: id, ...lifecycle }, null, 2),
      );
      await info.attach('lifecycle.json', {
        path: evidencePath,
        contentType: 'application/json',
      });
      // Read-only pages must exercise the actual cached-document path, not a new load.
      if (!editing) {
        expect(lifecycle.id).toBe(id);
        expect(lifecycle.restored).toBe(true);
      }
      expect(await editors(page)).toHaveLength(1);
    });
  }
});

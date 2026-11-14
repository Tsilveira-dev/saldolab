import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { activateEditing, setFinancialTime } from './helpers';

const key = 'saldolab:v1:personal';
const fixture = () => ({
  version: 1,
  accounts: [
    {
      id: 'qa-main',
      name: 'QA corrente',
      type: 'checking',
      initialBalanceCents: 100000,
      color: '#123456',
      icon: 'bank',
      createdAt: '2026-11-01',
    },
    {
      id: 'qa-reserve',
      name: 'QA reserva',
      type: 'savings',
      initialBalanceCents: 0,
      color: '#40876c',
      icon: 'wallet',
      createdAt: '2026-11-01',
    },
  ],
  categories: [
    { id: 'qa-income', name: 'QA receitas', type: 'income', color: '#40876c', icon: 'briefcase' },
    { id: 'qa-expense', name: 'QA despesas', type: 'expense', color: '#4d6386', icon: 'food' },
  ],
  transactions: [],
  budgets: [],
});
const snapshot = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key);
async function assertIncomeTooltip(page, amount) {
  await page
    .locator('.chart-area .recharts-bar')
    .first()
    .locator('.recharts-bar-rectangle')
    .last()
    .hover();
  await expect(page.locator('.chart-area .chart-tooltip')).toContainText(amount);
}
async function assertExpenseTooltip(page, amount) {
  const chart = page.locator('.donut-wrap');
  await expect(chart).toBeVisible();
  const box = await chart.boundingBox();
  const radius = Math.min(box.width, box.height) / 2;
  await expect(async () => {
    await chart.hover({ position: { x: box.width / 2 + radius * 0.85, y: box.height / 2 } });
    await expect(chart.locator('.chart-tooltip')).toContainText(amount, { timeout: 500 });
  }).toPass({ timeout: 5000 });
}
async function goto(page, path) {
  await page.goto(path);
  await expect(page.locator('main h1')).toBeVisible();
  await activateEditing(page);
}
async function nav(page, name) {
  if (await page.getByRole('button', { name: 'Abrir menu', exact: true }).isVisible())
    await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
  await page.getByRole('link', { name, exact: true }).click();
}
async function add(page, values = {}) {
  await page.getByRole('button', { name: 'Nova transação', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('[name=type]').selectOption(values.type ?? 'income');
  await dialog.locator('[name=description]').fill(values.description ?? 'QA receita');
  await dialog.locator('[name=amount]').fill(values.amount ?? '2500,00');
  await dialog.locator('[name=date]').fill(values.date ?? '2026-11-11');
  await dialog.locator('[name=accountId]').selectOption(values.accountId ?? 'qa-main');
  if (values.type === 'transfer')
    await dialog
      .locator('[name=destinationAccountId]')
      .selectOption(values.destinationAccountId ?? 'qa-reserve');
  else
    await dialog
      .locator('[name=categoryId]')
      .selectOption(values.categoryId ?? (values.type === 'expense' ? 'qa-expense' : 'qa-income'));
  await dialog.locator('[name=status]').selectOption(values.status ?? 'confirmed');
  await dialog.getByRole('button', { name: 'Adicionar registro', exact: true }).click();
  await expect(dialog).toHaveCount(0);
}
async function removeTransaction(page, description) {
  await page.getByRole('button', { name: `Excluir ${description}`, exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Excluir registro', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
const metric = (page, name) =>
  page.getByRole('region', { name, exact: true }).locator('.metric-value');
async function assertMoney(locator, number) {
  await expect(locator).toContainText(number);
}
test.beforeEach(async ({ page }) => {
  await setFinancialTime(page, '2026-11-11T15:00:00Z');
  await page.addInitScript(
    ({ key, data }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(data));
      if (localStorage.getItem('saldolab:preferences:v1') === null)
        localStorage.setItem(
          'saldolab:preferences:v1',
          JSON.stringify({ mode: 'personal', theme: 'light' }),
        );
    },
    { key, data: fixture() },
  );
});
test('receita 2500 → 3000 → excluir: indicadores, gráfico e persistência', async ({ page }) => {
  await goto(page, '/');
  await page.locator('input[type=month]').fill('2026-11');
  await add(page);
  await assertMoney(metric(page, 'Saldo disponível'), '3.500,00');
  await assertMoney(metric(page, 'Receitas do mês'), '2.500,00');
  await expect(page.locator('.chart-area .recharts-surface')).toBeVisible();
  await assertIncomeTooltip(page, '2.500,00');
  await page.reload();
  await expect(page.getByText('QA receita', { exact: true })).toBeVisible();
  await assertMoney(metric(page, 'Saldo disponível'), '3.500,00');
  await nav(page, 'Transações');
  await page.getByRole('button', { name: 'Editar QA receita', exact: true }).click();
  await page.getByRole('dialog').locator('[name=amount]').fill('3000,00');
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await nav(page, 'Dashboard');
  await assertMoney(metric(page, 'Receitas do mês'), '3.000,00');
  await assertMoney(metric(page, 'Saldo disponível'), '4.000,00');
  await assertIncomeTooltip(page, '3.000,00');
  await nav(page, 'Transações');
  await removeTransaction(page, 'QA receita');
  await nav(page, 'Dashboard');
  await assertMoney(metric(page, 'Saldo disponível'), '1.000,00');
  await assertMoney(metric(page, 'Receitas do mês'), '0,00');
  await expect(page.getByText('Seu histórico começa aqui', { exact: true })).toBeVisible();
});
test('despesa 750 → 800 → excluir: saldo, rosca e orçamento', async ({ page }) => {
  await goto(page, '/');
  await add(page, { type: 'expense', amount: '750,00', description: 'QA despesa' });
  await assertMoney(metric(page, 'Saldo disponível'), '250,00');
  await assertMoney(metric(page, 'Despesas do mês'), '750,00');
  await assertMoney(page.locator('.donut-label strong'), '750,00');
  await assertExpenseTooltip(page, '750,00');
  await page.reload();
  await assertMoney(metric(page, 'Despesas do mês'), '750,00');
  await nav(page, 'Transações');
  await page.getByRole('button', { name: 'Editar QA despesa', exact: true }).click();
  await page.getByRole('dialog').locator('[name=amount]').fill('800,00');
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await nav(page, 'Dashboard');
  await assertMoney(metric(page, 'Saldo disponível'), '200,00');
  await assertMoney(page.locator('.donut-label strong'), '800,00');
  await assertExpenseTooltip(page, '800,00');
  await nav(page, 'Transações');
  await removeTransaction(page, 'QA despesa');
  await nav(page, 'Dashboard');
  await assertMoney(metric(page, 'Saldo disponível'), '1.000,00');
  await expect(page.getByText('Nenhuma despesa no período', { exact: true })).toBeVisible();
});
test('contas: criar, ler, editar, excluir e saldo inicial', async ({ page }) => {
  await goto(page, '/contas');
  await page.getByRole('button', { name: 'Adicionar conta', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.locator('[name=name]').fill('QA carteira');
  await dialog.locator('[name=initialBalance]').fill('500,00');
  await dialog.getByRole('button', { name: 'Adicionar registro' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'QA carteira', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Editar QA carteira', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.locator('[name=name]').fill('QA carteira editada');
  await dialog.locator('[name=initialBalance]').fill('600,00');
  await dialog.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(dialog).toHaveCount(0);
  await assertMoney(page.locator('.accounts-total strong'), '1.600,00');
  await page.getByRole('button', { name: 'Excluir QA carteira editada', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Excluir registro' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await assertMoney(page.locator('.accounts-total strong'), '1.000,00');
});
test('transferência preserva patrimônio e protege origem e destino', async ({ page }) => {
  await goto(page, '/');
  await add(page, { type: 'transfer', amount: '300,00', description: 'QA transferência' });
  await assertMoney(metric(page, 'Saldo disponível'), '1.000,00');
  await assertMoney(metric(page, 'Receitas do mês'), '0,00');
  await assertMoney(metric(page, 'Despesas do mês'), '0,00');
  await nav(page, 'Contas');
  await assertMoney(
    page
      .locator('.account-card')
      .filter({ has: page.getByRole('heading', { name: 'QA corrente', exact: true }) })
      .locator('.account-balance strong'),
    '700,00',
  );
  await assertMoney(
    page
      .locator('.account-card')
      .filter({ has: page.getByRole('heading', { name: 'QA reserva', exact: true }) })
      .locator('.account-balance strong'),
    '300,00',
  );
  for (const name of ['QA corrente', 'QA reserva']) {
    await page.getByRole('button', { name: `Excluir ${name}`, exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Excluir registro' }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('possui movimentações');
    await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
  }
});
test('categoria: criar, editar, associar e impedir exclusão em uso', async ({ page }) => {
  await goto(page, '/categorias');
  await page.getByRole('button', { name: 'Nova categoria', exact: true }).click();
  await page.getByRole('dialog').locator('[name=name]').fill('QA educação');
  await page.getByRole('dialog').getByRole('button', { name: 'Adicionar registro' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Editar QA educação', exact: true }).click();
  await page.getByRole('dialog').locator('[name=name]').fill('QA cursos');
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const category = (await snapshot(page)).categories.find((item) => item.name === 'QA cursos');
  await nav(page, 'Dashboard');
  await add(page, {
    type: 'expense',
    amount: '50,00',
    description: 'QA curso',
    categoryId: category.id,
  });
  await nav(page, 'Categorias');
  await page.getByRole('button', { name: 'Excluir QA cursos', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Excluir registro' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('está em uso');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
});
test('orçamento: gasto, percentual, edição, excedente, duplicata e exclusão', async ({ page }) => {
  await goto(page, '/orcamentos');
  await page.getByRole('button', { name: 'Novo orçamento', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.locator('[name=categoryId]').selectOption('qa-expense');
  await dialog.locator('[name=month]').fill('2026-11');
  await dialog.locator('[name=limit]').fill('1000,00');
  await dialog.getByRole('button', { name: 'Adicionar registro' }).click();
  await expect(dialog).toHaveCount(0);
  await nav(page, 'Dashboard');
  await add(page, { type: 'expense', amount: '750,00', description: 'QA despesa orçada' });
  await nav(page, 'Orçamentos');
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '75');
  await page.getByRole('button', { name: 'Editar orçamento QA despesas', exact: true }).click();
  await page.getByRole('dialog').locator('[name=limit]').fill('500,00');
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '150');
  await expect(page.getByText(/250,00 excedidos/)).toBeVisible();
  await page.getByRole('button', { name: 'Novo orçamento', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.locator('[name=categoryId]').selectOption('qa-expense');
  await dialog.locator('[name=limit]').fill('800,00');
  await dialog.getByRole('button', { name: 'Adicionar registro' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Já existe um orçamento');
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await page.getByRole('button', { name: 'Excluir orçamento QA despesas', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Excluir registro' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await snapshot(page)).transactions).toHaveLength(1);
  expect((await snapshot(page)).budgets).toHaveLength(0);
});
test('pendências e confirmação recalculam saldo sem misturar transferências', async ({ page }) => {
  await goto(page, '/');
  await add(page, { status: 'pending' });
  await assertMoney(metric(page, 'Saldo disponível'), '1.000,00');
  await assertMoney(metric(page, 'Receitas do mês'), '0,00');
  await nav(page, 'Transações');
  await page.getByRole('button', { name: 'Editar QA receita', exact: true }).click();
  await page.getByRole('dialog').locator('[name=status]').selectOption('confirmed');
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await nav(page, 'Dashboard');
  await assertMoney(metric(page, 'Saldo disponível'), '3.500,00');
  await add(page, {
    type: 'expense',
    amount: '750,00',
    description: 'QA pendência',
    status: 'pending',
  });
  await assertMoney(metric(page, 'Saldo disponível'), '3.500,00');
  await assertMoney(metric(page, 'Despesas do mês'), '0,00');
});
test('backup exportado e importação validada preservam dados até a confirmação', async ({
  page,
}) => {
  await goto(page, '/configuracoes');
  let pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar backup JSON' }).click();
  const download = await pending;
  const backup = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(backup.app).toBe('SaldoLab');
  expect(backup.data).toEqual(fixture());
  const input = page.locator('input[type=file]');
  const original = await snapshot(page);
  await input.setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{invalid'),
  });
  await expect(page.getByRole('alert')).toContainText('JSON válido');
  expect(await snapshot(page)).toEqual(original);
  const data = fixture();
  data.accounts[0].initialBalanceCents = 200000;
  await input.setInputFiles({
    name: 'valid.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ app: 'SaldoLab', data })),
  });
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await snapshot(page)).toEqual(original);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Importar backup', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await snapshot(page)).toEqual(data);
  await nav(page, 'Dashboard');
  await assertMoney(metric(page, 'Saldo disponível'), '2.000,00');
});
test('corrupção mantém conteúdo bruto exportável e aceita recuperação explícita', async ({
  page,
}) => {
  await goto(page, '/');
  await page.evaluate((key) => localStorage.setItem(key, '{qa-corrupted'), key);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Seus dados precisam de atenção' })).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe('{qa-corrupted');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar conteúdo original' }).click();
  const download = await pending;
  expect(await readFile(await download.path(), 'utf8')).toBe('{qa-corrupted');
  await page.locator('input[type=file]').setInputFiles({
    name: 'recover.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ app: 'SaldoLab', data: fixture() })),
  });
  await page.getByRole('dialog').getByRole('button', { name: 'Recuperar dados' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Tudo em equilíbrio.' })).toBeVisible();
  expect(await snapshot(page)).toEqual(fixture());
});
test('armazenamento bloqueado e cota esgotada não sobrescrevem os dados anteriores', async ({
  page,
}) => {
  await goto(page, '/');
  const original = await snapshot(page);
  await page.evaluate((key) => {
    const previous = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException('QA quota', 'QuotaExceededError');
      return previous.call(this, name, value);
    };
  }, key);
  await page.getByRole('button', { name: 'Nova transação', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('[name=description]').fill('QA falha de armazenamento');
  await dialog.locator('[name=amount]').fill('10,00');
  await dialog.locator('[name=categoryId]').selectOption('qa-expense');
  await dialog.getByRole('button', { name: 'Adicionar registro' }).click();
  await expect(dialog.getByRole('alert')).toContainText('preservados');
  expect(await snapshot(page)).toEqual(original);
  await page.addInitScript((key) => {
    const previous = Storage.prototype.getItem;
    Storage.prototype.getItem = function (name) {
      if (name === key) throw new DOMException('QA blocked', 'SecurityError');
      return previous.call(this, name);
    };
  }, key);
  await page.reload();
  await expect(page.getByText(/O navegador bloqueou o armazenamento/)).toBeVisible();
});
test('os registros pessoais persistem sem expor a demonstração na interface', async ({ page }) => {
  await goto(page, '/');
  await add(page);
  const original = await snapshot(page);
  await nav(page, 'Configurações');
  await expect(page.getByRole('radio', { name: /Exemplo para explorar/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Exportar backup JSON' })).toBeVisible();
  await nav(page, 'Dashboard');
  await page.reload();
  expect(await snapshot(page)).toEqual(original);
  await assertMoney(metric(page, 'Saldo disponível'), '3.500,00');
});
test('entrada HTML é apresentada como texto, sem executar scripts', async ({ page }) => {
  await goto(page, '/');
  const description = '<img src=x onerror=window.__qaXss=1>';
  await add(page, { description });
  await expect(page.getByText(description, { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__qaXss)).toBeUndefined();
  expect(await page.locator('img[src=x]').count()).toBe(0);
});
test('filtros combinados, datas, relatórios e CSV refletem o mesmo conjunto', async ({ page }) => {
  await goto(page, '/');
  const data = fixture();
  const tx = (
    id,
    description,
    type,
    amountCents,
    date,
    accountId = 'qa-main',
    status = 'confirmed',
  ) => ({
    id,
    description,
    type,
    amountCents,
    date,
    accountId,
    status,
    categoryId: type === 'transfer' ? null : type === 'income' ? 'qa-income' : 'qa-expense',
    destinationAccountId: type === 'transfer' ? 'qa-reserve' : null,
    notes: '',
  });
  data.transactions = [
    tx('1', 'QA receita A', 'income', 250000, '2026-11-10'),
    tx('2', 'QA despesa A', 'expense', 75000, '2026-11-11'),
    tx('3', 'QA antiga', 'expense', 10000, '2026-10-11'),
    tx('4', 'QA transferência', 'transfer', 20000, '2026-11-12'),
    tx('5', 'QA receita reserva', 'income', 50000, '2026-11-12', 'qa-reserve'),
    tx('6', 'QA pendente', 'expense', 3000, '2026-11-13', 'qa-main', 'pending'),
  ];
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), {
    key,
    data,
  });
  await page.goto('/transacoes');
  await expect(page.locator('table tbody tr')).toHaveCount(5);
  await page.getByRole('combobox', { name: /^Tipo de transação/ }).selectOption('income');
  await page.getByRole('combobox', { name: /^Categoria da transação/ }).selectOption('qa-income');
  await page.getByRole('combobox', { name: /^Status da transação/ }).selectOption('confirmed');
  await page.getByRole('combobox', { name: /^Filtrar por conta/ }).selectOption('qa-reserve');
  await expect(page.locator('table tbody tr')).toHaveCount(1);
  await expect(page.getByText('QA receita reserva', { exact: true })).toBeVisible();
  await page.getByLabel('Buscar transações', { exact: true }).fill('inexistente');
  await expect(page.getByText('Nenhuma transação encontrada')).toBeVisible();
  await nav(page, 'Relatórios');
  await page.getByRole('combobox', { name: /^Filtrar por conta/ }).selectOption('');
  await page.getByLabel('De', { exact: true }).fill('2026-10-01');
  await page.getByLabel('Até', { exact: true }).fill('2026-11-30');
  await expect(page.locator('.inline-summary')).toContainText('3.000,00');
  await expect(page.locator('.inline-summary')).toContainText('850,00');
  await expect(page.locator('.inline-summary')).toContainText('2.150,00');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar CSV', exact: true }).click();
  const download = await pending;
  const csv = await readFile(await download.path(), 'utf8');
  expect(csv).toContain('QA antiga');
  expect(csv).toContain('QA pendente');
  expect(csv).toContain('"2500,00"');
  await page.getByLabel('De', { exact: true }).fill('2026-12-01');
  await expect(page.getByRole('alert')).toContainText('data inicial');
  await expect(page.getByRole('button', { name: 'Exportar CSV', exact: true })).toBeDisabled();
});
test('valores inválidos e transferência para a mesma conta não gravam dados', async ({ page }) => {
  await goto(page, '/');
  const before = await snapshot(page);
  await page.getByRole('button', { name: 'Nova transação', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('[name=description]').fill('QA inválida');
  await dialog.locator('[name=amount]').fill('0');
  await dialog.locator('[name=categoryId]').selectOption('qa-expense');
  await dialog.getByRole('button', { name: 'Adicionar registro' }).click();
  await expect(dialog.getByText('O valor deve ser maior que zero.')).toBeVisible();
  expect(await snapshot(page)).toEqual(before);
  await dialog.locator('[name=amount]').fill('10,001');
  await dialog.getByRole('button', { name: 'Adicionar registro' }).click();
  await expect(dialog.getByText('Use um valor como 150,00.')).toBeVisible();
  expect(await snapshot(page)).toEqual(before);
  await dialog.locator('[name=type]').selectOption('transfer');
  await dialog.locator('[name=amount]').fill('50,00');
  await dialog.locator('[name=destinationAccountId]').selectOption('qa-main');
  await dialog.getByRole('button', { name: 'Adicionar registro' }).click();
  await expect(dialog.getByText('Escolha uma conta diferente da origem.')).toBeVisible();
  expect(await snapshot(page)).toEqual(before);
});
test('cinco resoluções, modo escuro, menu e modais sem overflow de documento', async ({
  page,
}, info) => {
  for (const [width, height] of [
    [1440, 900],
    [1366, 768],
    [768, 1024],
    [390, 844],
    [360, 740],
  ]) {
    await page.setViewportSize({ width, height });
    await goto(page, '/');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`dashboard-${width}.png`),
      fullPage: true,
      animations: 'disabled',
    });
    await page.getByRole('button', { name: 'Nova transação', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
    await nav(page, 'Configurações');
    await page.getByRole('button', { name: 'Escuro', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.screenshot({
      path: info.outputPath(`dark-${width}.png`),
      fullPage: true,
      animations: 'disabled',
    });
  }
});

test('datas e mês financeiro mantêm São Paulo em cinco fusos na virada do ano', async ({
  browser,
}) => {
  for (const timezoneId of [
    'UTC',
    'America/Sao_Paulo',
    'America/New_York',
    'Asia/Tokyo',
    'Pacific/Kiritimati',
  ]) {
    const context = await browser.newContext({
      baseURL: process.env.BASE_URL || 'http://localhost:4173',
      timezoneId,
    });
    try {
      const page = await context.newPage();
      await setFinancialTime(page, '2026-01-01T01:00:00Z');
      await page.goto('/');
      await expect(page.locator('input[type=month]')).toHaveValue('2025-12');
      await activateEditing(page);
      await page.getByRole('button', { name: 'Nova transação', exact: true }).click();
      await expect(page.getByRole('dialog').locator('[name=date]')).toHaveValue('2025-12-31');
    } finally {
      await context.close();
    }
  }
});

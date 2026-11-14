import { test, expect } from '@playwright/test';
import { activateEditing } from './helpers';
import { createDemoData } from '../src/services/demo';

test.beforeEach(async ({ page }) => {
  const fixture = createDemoData();
  await page.addInitScript((seed) => {
    if (!localStorage.getItem('saldolab:v1:personal'))
      localStorage.setItem('saldolab:v1:personal', JSON.stringify(seed));
    if (!localStorage.getItem('saldolab:preferences:v1'))
      localStorage.setItem(
        'saldolab:preferences:v1',
        JSON.stringify({ mode: 'personal', theme: 'light' }),
      );
  }, fixture);
});

async function navigate(page, name) {
  const opener = page.getByRole('button', { name: 'Abrir menu' });
  if (await opener.isVisible()) await opener.click();
  await page.getByRole('link', { name, exact: true }).click();
}
test('cria, edita, persiste e exclui uma transação', async ({ page }) => {
  await page.goto('/transacoes');
  await activateEditing(page);
  await page.getByRole('button', { name: 'Nova transação', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Descrição', { exact: true }).fill('Teste ponta a ponta');
  await dialog.getByLabel('Valor (R$)', { exact: true }).fill('35,20');
  await dialog.getByRole('combobox', { name: /^Categoria/ }).selectOption('food');
  const month = await page.getByLabel('Mês de referência', { exact: true }).inputValue();
  await dialog.getByLabel('Data', { exact: true }).fill(`${month}-10`);
  await dialog.getByRole('button', { name: 'Adicionar registro' }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByLabel('Buscar transações', { exact: true }).fill('Teste ponta a ponta');
  await expect(page.getByText('Teste ponta a ponta', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByLabel('Buscar transações', { exact: true }).fill('Teste ponta a ponta');
  await page.getByRole('button', { name: 'Editar Teste ponta a ponta', exact: true }).click();
  await dialog.getByLabel('Valor (R$)', { exact: true }).fill('45,30');
  await dialog.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByRole('cell', { name: /45,30/ })).toBeVisible();
  await page.getByRole('button', { name: 'Excluir Teste ponta a ponta', exact: true }).click();
  await dialog.getByRole('button', { name: 'Excluir registro' }).click();
  await expect(page.getByText('Nenhuma transação encontrada')).toBeVisible();
});
test('campo monetário zerado fica vazio ao focar e preserva o novo saldo', async ({ page }) => {
  await page.goto('/contas');
  await activateEditing(page);
  await page.getByRole('button', { name: 'Adicionar conta', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.locator('[name=name]').fill('QA conta zerada');
  await dialog.locator('[name=initialBalance]').fill('0,00');
  await dialog.getByRole('button', { name: 'Adicionar registro' }).click();
  await expect(dialog).toHaveCount(0);

  await page.getByRole('button', { name: 'Editar QA conta zerada', exact: true }).click();
  dialog = page.getByRole('dialog');
  const amount = dialog.locator('[name=initialBalance]');
  await expect(amount).toHaveValue('0,00');
  await amount.focus();
  await expect(amount).toBeEmpty();
  await amount.fill('125,50');
  await dialog.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(dialog).toHaveCount(0);

  const balance = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('saldolab:v1:personal'));
    return data.accounts.find((account) => account.name === 'QA conta zerada').initialBalanceCents;
  });
  expect(balance).toBe(12550);
});

test('navega por todas as páginas, mantém rotas diretas e evita overflow do documento', async ({
  page,
}) => {
  for (const [route, heading] of [
    ['/', 'Tudo em equilíbrio.'],
    ['/transacoes', 'Cada movimento conta.'],
    ['/contas', 'Um lugar para cada conta.'],
    ['/categorias', 'Tudo no seu lugar.'],
    ['/orcamentos', 'Seu dinheiro com direção.'],
    ['/relatorios', 'Clareza que vira decisão.'],
    ['/configuracoes', 'Do seu jeito.'],
  ]) {
    await page.goto(route);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
  }
});
test('preserva dados pessoais ao recarregar, sem demonstração', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Cinema com amigos', { exact: true }).first()).toBeVisible();
  await page.goto('/configuracoes');
  await expect(page.getByRole('radio', { name: /Exemplo para explorar/ })).toHaveCount(0);
  await page.reload();
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('saldolab:preferences:v1')).mode),
  ).toBe('personal');
  await page.goto('/');
  await expect(page.getByText('Cinema com amigos', { exact: true }).first()).toBeVisible();
});
test('protege conta em uso e exporta backup JSON', async ({ page }) => {
  await page.goto('/contas');
  await activateEditing(page);
  await page.getByRole('button', { name: 'Excluir Conta principal', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Excluir registro' }).click();
  await expect(dialog.getByRole('alert')).toContainText('possui movimentações');
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await navigate(page, 'Configurações');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar backup JSON' }).click();
  expect((await downloaded).suggestedFilename()).toBe('saldolab-personal-backup.json');
});
test('cria orçamento, alerta duplicidade e alterna aparência', async ({ page }) => {
  await page.goto('/orcamentos');
  await activateEditing(page);
  await page.getByRole('button', { name: 'Novo orçamento', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Categoria de despesa').selectOption('education');
  await dialog.getByLabel('Limite mensal (R$)').fill('500,00');
  await dialog.getByRole('button', { name: 'Adicionar registro' }).click();
  await expect(page.getByText('Educação', { exact: true })).toBeVisible();
  await navigate(page, 'Configurações');
  await page.getByRole('button', { name: 'Escuro', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
test('registra aparência do dashboard e verifica ausência de erros de JavaScript', async ({
  page,
}, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Tudo em equilíbrio.', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.recharts-surface').first()).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('dashboard.png'),
    fullPage: true,
    animations: 'disabled',
  });
  expect(errors).toEqual([]);
});

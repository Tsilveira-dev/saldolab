import { test, expect } from '@playwright/test';

for (const type of ['expense', 'income'])
  test(`cria categoria de ${type} no lançamento e mantém o rascunho até editar/excluir`, async ({
    page,
  }) => {
    await page.addInitScript(
      ({ type }) => {
        const key = 'saldolab:v1:personal';
        if (!localStorage.getItem(key))
          localStorage.setItem(
            key,
            JSON.stringify({
              version: 1,
              accounts: [
                {
                  id: 'qa-account',
                  name: 'QA conta',
                  type: 'checking',
                  initialBalanceCents: 100000,
                  color: '#123456',
                  icon: 'bank',
                  createdAt: '2026-11-12',
                },
              ],
              categories:
                type === 'income'
                  ? [
                      {
                        id: 'qa-expense',
                        name: 'QA categoria de outro tipo',
                        type: 'expense',
                        color: '#123456',
                        icon: 'tag',
                      },
                    ]
                  : [],
              transactions: [],
              budgets: [],
            }),
          );
        if (!localStorage.getItem('saldolab:preferences:v1'))
          localStorage.setItem(
            'saldolab:preferences:v1',
            JSON.stringify({ mode: 'personal', theme: 'light' }),
          );
      },
      { type },
    );
    await page.goto('/transacoes');
    await page.getByRole('button', { name: 'Ativar edição', exact: true }).click();
    await expect(page.getByText('Edição ativa nesta aba', { exact: true })).toBeVisible();
    await page
      .locator('.page-heading')
      .getByRole('button', { name: 'Nova transação', exact: true })
      .click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('[name=type]').selectOption(type);
    await dialog.locator('[name=description]').fill('QA transação guiada');
    await dialog.locator('[name=amount]').fill('10,00');
    await expect(dialog.getByRole('button', { name: 'Adicionar registro' })).toBeDisabled();
    await expect(dialog.getByLabel('Nome da nova categoria')).toBeVisible();
    await expect(dialog.getByLabel('Nome da nova categoria')).toBeInViewport();
    await expect(dialog.getByText(/Você ainda não tem categorias de/)).toBeVisible();
    await dialog.getByLabel('Nome da nova categoria').fill('QA categoria no lançamento');
    await dialog
      .getByRole('button', {
        name: 'Criar categoria de ' + (type === 'income' ? 'receita' : 'despesa'),
        exact: true,
      })
      .click();
    await expect(dialog.locator('[name=categoryId] option:checked')).toHaveText(
      'QA categoria no lançamento',
    );
    await expect(dialog.locator('[name=description]')).toHaveValue('QA transação guiada');
    await expect(dialog.locator('[name=amount]')).toHaveValue('10,00');
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('saldolab:v1:personal')),
    );
    expect(stored.transactions).toHaveLength(0);
    expect(
      stored.categories.some((c) => c.name === 'QA categoria no lançamento' && c.type === type),
    ).toBe(true);
    await dialog.getByRole('button', { name: 'Adicionar registro', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page.getByRole('button', { name: 'Editar QA transação guiada', exact: true }).click();
    await dialog.locator('[name=amount]').fill('20,00');
    await dialog.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(dialog).toHaveCount(0);
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem('saldolab:v1:personal')).transactions[0].amountCents,
      ),
    ).toBe(2000);
    await page.getByRole('button', { name: 'Excluir QA transação guiada', exact: true }).click();
    await dialog.getByRole('button', { name: 'Excluir registro', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem('saldolab:v1:personal')).transactions.length,
      ),
    ).toBe(0);
  });

test('uma transação vazia oferece cadastro rápido de conta e categoria antes de observações', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'saldolab:v1:personal',
      JSON.stringify({ version: 1, accounts: [], categories: [], transactions: [], budgets: [] }),
    );
    localStorage.setItem(
      'saldolab:preferences:v1',
      JSON.stringify({ mode: 'personal', theme: 'light' }),
    );
  });
  await page.goto('/transacoes');
  await page.getByRole('button', { name: 'Ativar edição', exact: true }).click();
  await page.locator('.page-heading').getByRole('button', { name: 'Nova transação' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Descrição', { exact: true }).fill('Mercado QA');
  await dialog.getByLabel('Valor (R$)', { exact: true }).fill('100,00');
  await expect(dialog.getByLabel('Nome da nova conta')).toBeVisible();
  await expect(dialog.getByLabel('Nome da nova categoria')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Adicionar registro' })).toBeDisabled();
  await dialog.getByLabel('Nome da nova conta').fill('Conta para testes');
  await dialog.getByRole('button', { name: 'Criar conta e selecionar' }).click();
  await expect(dialog.locator('[name=accountId] option:checked')).toHaveText('Conta para testes');
  await dialog.getByLabel('Nome da nova categoria').fill('Compras QA');
  await dialog.getByRole('button', { name: 'Criar categoria de despesa' }).click();
  await expect(dialog.locator('[name=categoryId] option:checked')).toHaveText('Compras QA');
  await expect(dialog.getByLabel('Descrição', { exact: true })).toHaveValue('Mercado QA');
  await expect(dialog.getByLabel('Valor (R$)', { exact: true })).toHaveValue('100,00');
  await dialog.getByRole('button', { name: 'Adicionar registro' }).click();
  await expect(dialog).toHaveCount(0);
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('saldolab:v1:personal')),
  );
  expect(stored.accounts).toHaveLength(1);
  expect(stored.categories).toHaveLength(1);
  expect(stored.transactions).toHaveLength(1);
  expect(stored.transactions[0].amountCents).toBe(10000);
});

for (const mode of ['personal', 'demo']) {
  test(`no modo ${mode}, cadastrar transação grava, exibe confirmação correta e persiste após reload`, async ({
    page,
  }) => {
    await page.addInitScript(
      ({ mode }) => {
        const key = `saldolab:v1:${mode}`;
        if (!localStorage.getItem(key))
          localStorage.setItem(
            key,
            JSON.stringify({
              version: 1,
              accounts: [
                {
                  id: 'test-account',
                  name: 'Conta teste local',
                  type: 'checking',
                  initialBalanceCents: 100000,
                  color: '#123456',
                  icon: 'bank',
                  createdAt: '2026-11-13',
                },
              ],
              categories: [
                {
                  id: 'test-expense',
                  name: 'Mercado teste local',
                  type: 'expense',
                  color: '#123456',
                  icon: 'tag',
                },
              ],
              transactions: [],
              budgets: [],
            }),
          );
        if (!localStorage.getItem('saldolab:preferences:v1'))
          localStorage.setItem('saldolab:preferences:v1', JSON.stringify({ mode, theme: 'light' }));
      },
      { mode },
    );
    await page.goto('/transacoes');
    await page.getByRole('button', { name: 'Ativar edição', exact: true }).click();
    await page.locator('.page-heading').getByRole('button', { name: 'Nova transação' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Descrição', { exact: true }).fill('Compra registrada');
    await dialog.getByLabel('Valor (R$)', { exact: true }).fill('100,00');
    await expect(dialog.locator('[name=categoryId] option[value="test-expense"]')).toHaveCount(1);
    await dialog.locator('[name=categoryId]').selectOption('test-expense');
    await expect(dialog.getByRole('button', { name: 'Adicionar registro' })).toBeEnabled();
    await dialog.getByRole('button', { name: 'Adicionar registro' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText('Transação cadastrada com sucesso.')).toBeVisible();
    const read = () =>
      page.evaluate(({ mode }) => JSON.parse(localStorage.getItem(`saldolab:v1:${mode}`)), {
        mode,
      });
    expect((await read()).transactions).toHaveLength(1);
    expect((await read()).transactions[0].amountCents).toBe(10000);
    await page.reload();
    expect((await read()).transactions).toHaveLength(1);
    await expect(page.getByText('Compra registrada', { exact: true })).toBeVisible();
    const otherMode = mode === 'personal' ? 'demo' : 'personal';
    const other = await page.evaluate(
      ({ otherMode }) => localStorage.getItem(`saldolab:v1:${otherMode}`),
      { otherMode },
    );
    expect(other).toBeNull();
  });
}

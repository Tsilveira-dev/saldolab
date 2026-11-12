import { test, expect } from '@playwright/test';

// A valid-looking public URL is enough to exercise Vite's Neon Auth initialization.
// No real Neon credentials or account are used in CI.
test('o Preview com Neon configurado renderiza a página de acesso sem tela branca', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.route('**/*.neonauth.*/**', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: null, error: null }),
    }),
  );

  await page.goto('/nuvem');
  await expect(page.getByRole('heading', { name: 'SaldoLab na nuvem' })).toBeVisible();
  await expect(page.locator('#root')).not.toBeEmpty();
  expect(errors).toEqual([]);
});

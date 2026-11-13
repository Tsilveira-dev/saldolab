import { test, expect } from '@playwright/test';

test.skip(
  !process.env.VITE_NEON_AUTH_URL,
  'Neon Auth cloud smoke only runs with a configured test URL.',
);

// A valid-looking public URL is enough to exercise Vite's Neon Auth initialization.
// No real Neon credentials or account are used in CI.
test('o Preview com Neon configurado renderiza a página de acesso sem tela branca', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push('console: ' + message.text());
  });

  await page.route('**/*.neonauth.*/**', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: null, error: null }),
    }),
  );

  await page.goto('/nuvem');
  await page.waitForTimeout(1000);
  expect(errors, 'JavaScript errors during Neon initialization').toEqual([]);
  await expect(page.getByRole('heading', { name: 'Minha conta' })).toBeVisible();
  await expect(page.locator('#root')).not.toBeEmpty();
  expect(errors).toEqual([]);
});

test('recuperação de senha aparece e não revela se a conta existe', async ({ page }) => {
  await page.route('**/*.neonauth.*/**', async (route) => {
    if (route.request().url().endsWith('/request-password-reset')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: null, error: null }),
    });
  });
  await page.goto('/nuvem');
  await page.getByRole('button', { name: 'Esqueci minha senha' }).click();
  await expect(page.getByRole('heading', { name: 'Esqueci minha senha' })).toBeVisible();
  await page.getByRole('textbox', { name: 'E-mail da sua conta' }).fill('test@example.com');
  await page.getByRole('button', { name: 'Enviar link de recuperação' }).click();
  await expect(page.getByText(/Se esse e-mail estiver cadastrado/)).toBeVisible();
});

test('link de redefinição usa o token sem mantê-lo na barra do navegador', async ({ page }) => {
  await page.route('**/*.neonauth.*/**', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: null, error: null }),
    }),
  );
  await page.goto('/nuvem?token=token-ficticio-de-teste');
  await expect(page.getByRole('heading', { name: 'Redefinir senha' })).toBeVisible();
  await expect.poll(() => page.url()).not.toContain('token-ficticio-de-teste');
});

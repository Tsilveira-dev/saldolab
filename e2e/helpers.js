import { expect } from '@playwright/test';

// Freeze financial dates only. Playwright's clock also clears Navigation Timing,
// which would prevent these tests from exercising real reload/session behavior.
export async function setFinancialTime(page, date) {
  const timestamp = new Date(date).getTime();
  await page.addInitScript((fixedTime) => {
    const ActualDate = Date;
    class FixedDate extends ActualDate {
      constructor(...args) {
        super(...(args.length ? args : [fixedTime]));
      }
      static now() {
        return fixedTime;
      }
    }
    window.Date = FixedDate;
  }, timestamp);
}

export async function activateEditing(page) {
  const notice = page.getByRole('region', { name: 'Permissão de edição' });
  await expect(notice).toBeVisible();
  if (await notice.getByRole('button', { name: 'Encerrar edição', exact: true }).isVisible())
    return;
  await notice.getByRole('button', { name: 'Ativar edição', exact: true }).click();
  await expect(notice.getByText('Edição ativa nesta aba', { exact: true })).toBeVisible();
}

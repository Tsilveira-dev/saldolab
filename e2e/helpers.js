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
  // The app now acquires the local editing lease on startup.
  // On locked/unsupported browsers the add action stays disabled.
  const addButton = page.getByRole('button', { name: 'Adicionar transação', exact: true });
  await expect(addButton).toBeEnabled();
}

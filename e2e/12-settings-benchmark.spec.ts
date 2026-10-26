import { expect, test } from '@playwright/test';

// FR-TUN-03: benchmark of the 3 seed offenses x 3 seed defenses (10 runs each) gives 9 rows.
test('12 benchmark with 10 runs fills 9 rows', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/settings');
  await page.getByTestId('bench-runs').selectOption('10');
  await page.getByTestId('bench-run').click();
  await expect(page.locator('[data-testid^="bench-row-"]')).toHaveCount(9, { timeout: 150_000 });
  await expect(page.getByTestId('bench-run')).toBeEnabled();
});

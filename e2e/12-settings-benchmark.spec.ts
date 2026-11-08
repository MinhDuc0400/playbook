import { expect, test } from '@playwright/test';
import { enableAdvanced } from './fixtures';

// FR-TUN-03: benchmark of the 4 seed offenses x 5 seed defenses (10 runs each) gives 20 rows (D-42 adds
// Bunch Tight and the two Bunch Killer defenses).
test('12 benchmark with 10 runs fills 20 rows', async ({ page }) => {
  await enableAdvanced(page);
  test.setTimeout(180_000);
  await page.goto('/settings');
  await page.getByTestId('bench-runs').selectOption('10');
  await page.getByTestId('bench-run').click();
  await expect(page.locator('[data-testid^="bench-row-"]')).toHaveCount(20, { timeout: 150_000 });
  await expect(page.getByTestId('bench-run')).toBeEnabled();
});

import { expect, test } from '@playwright/test';
import { SEED, createMatchup } from './fixtures';

// FR-MU-13: "Chạy 50 lần" runs in the Worker and shows the aggregate.
test('08 run 50 shows the aggregate result', async ({ page }) => {
  await createMatchup(page, SEED.flood, SEED.cover1);
  await page.getByTestId('run-many').click();
  await expect(page.getByTestId('run-many-result')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('run-many-pcomplete')).toHaveText(/\d+(\.\d)?%/);
  await expect(page.getByTestId('run-many-avgyards')).not.toHaveText('');
  await expect(page.getByTestId('run-many-stale')).toHaveCount(0);
});

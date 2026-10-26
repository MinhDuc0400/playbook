import { expect, test } from '@playwright/test';
import { SEED, waitSavedAfterEdit, createMatchup } from './fixtures';

// Scenario 6: install with 3 items, present, navigate with the arrow keys.
test('06 install of 3 matchups is presented and navigated with arrow keys', async ({ page }) => {
  const m1 = await createMatchup(page, SEED.flood, SEED.cover1);
  const m2 = await createMatchup(page, SEED.mesh, SEED.cover1);
  const m3 = await createMatchup(page, SEED.smash, SEED.cover2);

  await page.goto('/install');
  await page.getByTestId('install-new-name').fill('E2E Install');
  await page.getByTestId('install-create').click();
  await page.waitForURL(/\/install\/[^/]+$/);

  await page.getByTestId('install-add').click();
  for (const id of [m1, m2, m3]) await page.getByTestId(`picker-${id}`).check();
  await page.getByTestId('picker-confirm').click();
  await expect(page.locator('[data-testid^="install-item-"]')).toHaveCount(3);
  await waitSavedAfterEdit(page, 'install-save-status');

  await page.getByTestId('install-present').click();
  await expect(page.getByTestId('present-page')).toBeVisible();
  const index = page.getByTestId('present-index');
  await expect(index).toHaveText('1 / 3');
  await page.keyboard.press('ArrowRight');
  await expect(index).toHaveText('2 / 3');
  await page.keyboard.press('ArrowRight');
  await expect(index).toHaveText('3 / 3');
  await page.keyboard.press('ArrowLeft');
  await expect(index).toHaveText('2 / 3');
});

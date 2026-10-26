import { expect, test } from '@playwright/test';
import { tokenCenter, createPlay, waitSavedAfterEdit } from './fixtures';

// Scenario 2: defense Cover 1 over the ghost offense, assign a man, save.
test('02 defense Cover 1 with a man assignment to the ghost receiver', async ({ page }) => {
  await createPlay(page, { side: 'defense', formation: 'Cover 1', name: 'E2E Cover 1' });

  await page.getByTestId('tool-man').click();
  const cb = await tokenCenter(page, 'CB1');
  await page.mouse.click(cb.x, cb.y);
  await page.getByTestId('ghost-hit-Z').click();
  await expect(page.getByTestId('man-CB1')).toBeVisible();

  await page.getByTestId('tool-select').click();
  const c = await tokenCenter(page, 'CB1');
  await page.mouse.click(c.x, c.y);
  await expect(page.getByTestId('def-man-target')).toHaveText('Strong #1');

  await waitSavedAfterEdit(page);
});

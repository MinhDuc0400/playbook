import { expect, test } from '@playwright/test';
import { createPlay, tokenCenter, waitSavedAfterEdit } from './fixtures';

// FR-IO-05: backup banner after creating data; "export now" hides it.
test('14 backup banner shows after creating a play and export-now hides it', async ({ page }) => {
  await createPlay(page, { side: 'offense', formation: 'Trips', name: 'E2E Backup' });
  await waitSavedAfterEdit(page);
  await expect(page.getByTestId('backup-banner')).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('backup-export-now').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^flagbook-.*\.json$/);
  await expect(page.getByTestId('backup-banner')).toHaveCount(0);
});

// FR-OFF-07: motion drawn with the motion tool is rendered.
test('14 motion tool draws a motion for Z', async ({ page }) => {
  await createPlay(page, { side: 'offense', formation: 'Trips', name: 'E2E Motion' });
  await page.getByTestId('tool-motion').click();
  const c = await tokenCenter(page, 'Z');
  await page.mouse.click(c.x, c.y);
  await page.mouse.click(c.x - 40, c.y + 10);
  await page.mouse.click(c.x - 80, c.y + 10);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('motion-Z')).toBeVisible();
  await waitSavedAfterEdit(page);
});

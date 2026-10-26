import { expect, test } from '@playwright/test';
import { tokenCenter, createPlay, waitSavedAfterEdit } from './fixtures';

// Scenario 1: 5v5 offense play, 3 routes, close the tab, reopen: data is intact.
test('01 offense 5v5 with 3 routes survives closing the tab', async ({ page, context }) => {
  const id = await createPlay(page, { side: 'offense', formation: 'Trips', name: 'E2E Trips' });
  await page.getByTestId('tool-route').click();

  for (const label of ['Z', 'Y', 'H']) {
    const c = await tokenCenter(page, label);
    await page.mouse.click(c.x, c.y);
    await page.mouse.click(c.x - 20, c.y - 110);
    await page.mouse.click(c.x - 90, c.y - 170);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId(`route-${label}`)).toBeVisible();
  }

  await waitSavedAfterEdit(page);
  await page.close();

  const reopened = await context.newPage();
  await reopened.goto(`/play/${id}`);
  await expect(reopened.getByTestId('editor-page')).toBeVisible();
  await expect(reopened.getByTestId('play-name')).toHaveValue('E2E Trips');
  for (const label of ['Z', 'Y', 'H']) {
    await expect(reopened.getByTestId(`route-${label}`)).toBeVisible();
  }
});

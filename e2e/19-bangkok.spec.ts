import { expect, test } from '@playwright/test';
import { playToEnd, tokenCenter } from './fixtures';

// D-40..D-42: the Bunch Killer (Bangkok) install ships ready-made and runs.
const INSTALL = 'seed-install-bangkok';

test('19 Bunch Killer install is seeded, its matchup runs, the editor shows area-match lanes', async ({
  page,
}) => {
  await page.goto('/install');
  const row = page.getByTestId(`install-row-${INSTALL}`);
  await expect(row).toContainText('Red Zone – Bunch Killer (Bangkok)');

  await page.goto(`/install/${INSTALL}`);
  await expect(page.locator('[data-testid^="install-item-"]')).toHaveCount(4);

  await page.goto('/matchup/seed-mu-bangkok-rush-bunch');
  await expect(page.getByTestId('matchup-field')).toBeVisible();
  await expect(page.getByTestId('open-windows')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('matchup-sim-error')).toHaveCount(0);
  await playToEnd(page);

  await page.goto('/play/seed-def-bangkok-rush');
  await expect(page.getByTestId('editor-page')).toBeVisible();
  await expect(page.getByTestId('play-name')).toHaveValue('Zone: Bunch Killer (Bangkok) Rush');
  await expect(page.getByTestId('area-lane-boundary')).toHaveCount(3);
  const cb1 = await tokenCenter(page, 'CB1');
  await page.mouse.click(cb1.x, cb1.y);
  await expect(page.getByTestId('def-area-match')).toHaveValue('corner');
});

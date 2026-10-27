import { expect, test } from '@playwright/test';
import { SEED, createMatchup, enableAdvanced } from './fixtures';

// FR-ATH-04/05/06: athlete (Hay) -> 5v5 Trips lineup with that athlete on Z -> used by a matchup.
test('11 a lineup with a good athlete on Z turns the Z ring good in a matchup', async ({ page }) => {
  await enableAdvanced(page);
  await page.goto('/roster');
  await page.getByTestId('tab-athletes').click();
  await page.getByTestId('athlete-new').click();
  await page.getByTestId('athlete-name').fill('E2E Star');
  await page.getByTestId('athlete-preset').selectOption({ label: 'Hay' });
  await page.getByTestId('athlete-save').click();
  await expect(page.locator('[data-testid^="athlete-row-"]')).toHaveCount(1);

  await page.getByTestId('tab-lineups').click();
  await page.getByTestId('lineup-new-name').fill('E2E Lineup');
  await page.getByTestId('lineup-new-side').selectOption('offense');
  await page.getByTestId('lineup-new-format').selectOption('5v5');
  await page.getByTestId('lineup-new-formation').selectOption({ label: 'Trips' });
  await page.getByTestId('lineup-create').click();
  await page.getByTestId('lineup-assign-Z').selectOption({ label: 'E2E Star' });
  await page.getByTestId('lineup-save').click();
  await expect(page.locator('[data-testid^="lineup-row-"]')).toHaveCount(1);

  await createMatchup(page, SEED.flood, SEED.cover1);
  const body = page.getByTestId('matchup-field').getByTestId('token-Z').locator('[data-part="body"]');
  await expect(body).not.toHaveAttribute('stroke', '#16a34a');
  await page.getByTestId('ctl-lineup-offense').selectOption({ label: 'E2E Lineup' });
  await expect(body).toHaveAttribute('stroke', '#16a34a');
});

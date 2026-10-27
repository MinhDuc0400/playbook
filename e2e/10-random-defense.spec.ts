import { expect, test } from '@playwright/test';
import { SEED, createMatchup, enableAdvanced } from './fixtures';

// FR-RD-01..03: random defense hides its name, the user guesses, reveal shows right/wrong.
test('10 random defense hides the name, guess then reveal shows the result', async ({ page }) => {
  await enableAdvanced(page);
  await createMatchup(page, SEED.flood, SEED.cover1);
  await page.getByTestId('rd-random').click();
  await expect(page.getByTestId('defense-name-hidden')).toBeVisible();
  await expect(page.getByTestId('edit-defense')).toHaveCount(0);

  await page.getByTestId('rd-guess-cov:cover-3').click();
  await page.getByTestId('rd-reveal').click();
  await expect(page.getByTestId('rd-result')).toBeVisible();
  await expect(page.getByTestId('defense-name-hidden')).toHaveCount(0);
  await expect(page.getByTestId('edit-defense')).toBeVisible();
  await expect(page.getByTestId('rd-score')).toContainText('/ 1');
});

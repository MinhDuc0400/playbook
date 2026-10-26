import { expect, test } from '@playwright/test';
import { SEED } from './fixtures';

// FR-SG-01/02: tag tier first (Smash beats Cover 2), then the sim tier re-ranks with reasons.
test('09 suggest ranks Smash first against Cover 2, then re-ranks by simulation', async ({ page }) => {
  await page.goto('/suggest');
  await page.getByTestId('sg-play').selectOption({ label: 'Cover 2' });

  const rows = page.locator('[data-testid^="sg-row-"]');
  await expect(rows.first()).toHaveAttribute('data-testid', `sg-row-${SEED.smash}`);
  await expect(page.getByTestId(`sg-reasons-${SEED.smash}`)).toContainText('beats:cover-2');

  await page.getByTestId('sg-run-sim').click();
  await expect(page.getByTestId('sg-progress')).toBeVisible();
  await expect(page.getByTestId('sg-progress')).toHaveCount(0, { timeout: 90_000 });

  // Sim tier: every row has a reason line with the simulated completion / yards.
  await expect(rows.first()).toBeVisible();
  const count = await rows.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const id = (await rows.nth(i).getAttribute('data-testid'))!.replace('sg-row-', '');
    await expect(page.getByTestId(`sg-reasons-${id}`)).toContainText('Hoàn thành');
  }
  await expect(page.getByTestId('sg-message')).toHaveCount(0);
});

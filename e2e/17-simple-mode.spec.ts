import { expect, test } from '@playwright/test';
import { SEED, createMatchup, seekTo } from './fixtures';

// D-26 Simple mode (default): plays → matchup → open windows → install/present, nothing advanced reachable.
test('17 simple mode: core flow without advanced features', async ({ page, viewport }) => {
  const phone = !!viewport && viewport.width < 1024;
  await page.goto('/');
  await expect(page.getByTestId(`card-${SEED.smash}`)).toBeVisible();

  // Navigation: Roster and Suggest are hidden and their routes redirect home.
  if (phone) await page.getByTestId('nav-menu-button').click();
  await expect(page.getByTestId('nav-install')).toBeVisible();
  await expect(page.getByTestId('nav-roster')).toHaveCount(0);
  await expect(page.getByTestId('nav-suggest')).toHaveCount(0);
  await page.goto('/roster');
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/suggest');
  await expect(page).toHaveURL(/\/$/);

  // Matchup: open windows panel + flips; advanced controls absent.
  await createMatchup(page, SEED.smash, SEED.cover2);
  await expect(page.getByTestId('open-windows')).toBeVisible();
  await expect(page.locator('[data-testid^="ow-row-"]')).not.toHaveCount(0);
  for (const id of ['ctl-offense-flipped', 'ctl-defense-flip']) {
    if (phone) await page.getByTestId('panel-tabs-tab-params').click();
    await expect(page.getByTestId(id)).toBeVisible();
  }
  for (const id of [
    'run-many',
    'ctl-seed',
    'ctl-noise',
    'ctl-anticipation',
    'rd-random',
    'player-panel',
    'read-timeline',
  ]) {
    await expect(page.getByTestId(id), id).toHaveCount(0);
  }

  // QB throw controls are part of Simple mode: key press and "ném lúc open nhất".
  await page.getByTestId('qb-mode-toggle').check();
  await expect(page.locator('[data-testid^="qb-key-"]').first()).toBeVisible();
  await seekTo(page, 1.4);
  await page.keyboard.press('w');
  await expect(page.getByTestId('qb-feedback-score')).toBeVisible();
  await page.getByTestId('qb-retry').click();
  await page.locator('[data-testid^="qb-best-"]:not([data-testid="qb-best-none"])').first().click();
  await expect(page.getByTestId('qb-feedback-best-time').or(page.getByTestId('qb-best-none'))).toBeVisible();
  await page.getByTestId('qb-exit').click();

  // Install → present shows the same open windows strip.
  await page.goto('/install');
  await page.getByTestId('install-new-name').fill('Simple');
  await page.getByTestId('install-create').click();
  await page.getByTestId('install-add').click();
  await page.locator('[data-testid^="picker-"]:not([data-testid="picker-confirm"])').first().check();
  await page.getByTestId('picker-confirm').click();
  await page.getByTestId('install-present').click();
  await expect(page.getByTestId('open-windows')).toBeVisible();
});

test('17 advanced switch brings the hidden screens back', async ({ page, viewport }) => {
  const phone = !!viewport && viewport.width < 1024;
  await page.goto('/settings');
  await expect(page.getByTestId('settings-section-tuning')).toHaveCount(0);
  await page.getByTestId('settings-advanced').check();
  await expect(page.getByTestId('settings-section-tuning')).toBeVisible();
  if (phone) await page.getByTestId('nav-menu-button').click();
  await expect(page.getByTestId('nav-roster')).toBeVisible();
  await expect(page.getByTestId('nav-suggest')).toBeVisible();
  await page.getByTestId('settings-advanced').uncheck();
  await expect(page.getByTestId('settings-section-tuning')).toHaveCount(0);
});

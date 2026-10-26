import { expect, test } from '@playwright/test';
import { SEED, waitSavedAfterEdit, createMatchup, idFromUrl } from './fixtures';

// Scenario 7: export JSON, open an empty profile, import (replace): everything is restored.
test('07 export then import in a fresh profile restores matchup and install', async ({
  page,
  browser,
}, testInfo) => {
  const matchupId = await createMatchup(page, SEED.mesh, SEED.cover1);

  await page.goto('/install');
  await page.getByTestId('install-new-name').fill('E2E Export Install');
  await page.getByTestId('install-create').click();
  await page.waitForURL(/\/install\/[^/]+$/);
  const installId = idFromUrl(page.url(), 'install');
  await page.getByTestId('install-add').click();
  await page.getByTestId(`picker-${matchupId}`).check();
  await page.getByTestId('picker-confirm').click();
  await expect(page.locator('[data-testid^="install-item-"]')).toHaveCount(1);
  await waitSavedAfterEdit(page, 'install-save-status');

  await page.goto('/settings');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('btn-export').click(),
  ]);
  const file = testInfo.outputPath('flagbook-export.json');
  await download.saveAs(file);

  // Fresh context = empty IndexedDB, so only the seed data exists.
  const fresh = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  try {
    const p2 = await fresh.newPage();
    await p2.goto(`/matchup/${matchupId}`);
    await expect(p2.getByTestId('matchup-not-found')).toBeVisible();

    await p2.goto('/settings');
    await p2.getByTestId('import-file').setInputFiles(file);
    await p2.getByTestId('import-mode-replace').check();
    await p2.getByTestId('btn-import').click();
    await p2.getByTestId('import-confirm-yes').click();
    await expect(p2.getByTestId('import-report')).toBeVisible({ timeout: 20_000 });

    await p2.goto(`/matchup/${matchupId}`);
    await expect(p2.getByTestId('matchup-field')).toBeVisible();
    await expect(p2.getByTestId('result-outcome')).toBeVisible({ timeout: 20_000 });

    await p2.goto(`/install/${installId}`);
    await expect(p2.getByTestId('install-name')).toHaveValue('E2E Export Install');
    await expect(p2.locator('[data-testid^="install-item-"]')).toHaveCount(1);
  } finally {
    await fresh.close();
  }
});

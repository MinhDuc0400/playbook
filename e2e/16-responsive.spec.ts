import { expect, test, type Page } from '@playwright/test';
import { SEED, createMatchup } from './fixtures';

// D-25: every screen fits the viewport (no horizontal page scroll) on phone, tablet and desktop.
async function expectNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  await page.waitForLoadState('networkidle');
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth, `${label}: page wider than the viewport`).toBeLessThanOrEqual(innerWidth + 1);
}

test('16 no horizontal overflow on every screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId(`card-${SEED.smash}`)).toBeVisible();
  await expectNoHorizontalOverflow(page, 'playbook');

  await page.goto(`/play/${SEED.smash}`);
  await expect(page.getByTestId('field-svg')).toBeVisible();
  await expectNoHorizontalOverflow(page, 'editor offense');

  await page.goto(`/play/${SEED.cover2}`);
  await expect(page.getByTestId('field-svg')).toBeVisible();
  await expectNoHorizontalOverflow(page, 'editor defense');

  await createMatchup(page, SEED.smash, SEED.cover2);
  await expect(page.getByTestId('matchup-field')).toBeVisible();
  await expectNoHorizontalOverflow(page, 'matchup');

  for (const path of ['/install', '/roster', '/suggest', '/settings']) {
    await page.goto(path);
    await expectNoHorizontalOverflow(page, path);
  }

  await page.goto('/install');
  await page.getByTestId('install-new-name').fill('Responsive');
  await page.getByTestId('install-create').click();
  await expect(page).toHaveURL(/\/install\/[^/]+$/);
  await expectNoHorizontalOverflow(page, 'install detail');
  await page.goto(`${new URL(page.url()).pathname}/present`);
  await expectNoHorizontalOverflow(page, 'present');
});

test('16 phone/tablet: field first, panels in tabs', async ({ page, viewport }) => {
  test.skip(!viewport || viewport.width >= 1024, 'layout check for phone/tablet widths only');
  await page.goto(`/play/${SEED.smash}`);
  const field = page.getByTestId('field-svg');
  await expect(field).toBeVisible();
  const tabs = page.getByTestId('panel-tabs');
  await expect(tabs).toHaveAttribute('data-mode', 'tabs');
  const fieldBox = await field.boundingBox();
  const tabsBox = await tabs.boundingBox();
  expect(fieldBox && tabsBox && fieldBox.y < tabsBox.y).toBe(true);
  // The field gets a usable share of the screen width.
  expect(fieldBox!.width).toBeGreaterThan(viewport!.width * 0.8);

  await createMatchup(page, SEED.smash, SEED.cover2);
  await expect(page.getByTestId('matchup-field')).toBeVisible();
  await expect(page.getByTestId('panel-tabs').first()).toHaveAttribute('data-mode', 'tabs');
});

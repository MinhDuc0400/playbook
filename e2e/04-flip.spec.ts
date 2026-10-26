import { expect, test, type Page } from '@playwright/test';
import { SEED, createMatchup, manTarget } from './fixtures';

async function tokenX(page: Page, label: string): Promise<number> {
  const box = await page.getByTestId('matchup-field').getByTestId(`token-${label}`).boundingBox();
  return box?.x ?? NaN;
}

// Scenario 4: flipping the offense auto-flips the defense; the man stays on the same receiver.
test('04 offense flip with auto defense flip keeps man assignments on the same receiver', async ({
  page,
}) => {
  await createMatchup(page, SEED.flood, SEED.cover1);
  await expect(page.getByTestId('ctl-defense-flip')).toHaveValue('auto');

  const before = await manTarget(page);
  expect(before.label).not.toBe('');
  expect(before.dist).toBeLessThan(4);
  const xBefore = await tokenX(page, before.label);

  await page.getByTestId('ctl-offense-flipped').check();
  await expect.poll(() => tokenX(page, before.label)).not.toBeCloseTo(xBefore, 0);

  await expect.poll(async () => (await manTarget(page)).label).toBe(before.label);
  expect((await manTarget(page)).dist).toBeLessThan(4);
});

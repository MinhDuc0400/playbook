import { expect, test, type Page } from '@playwright/test';
import { SEED, createMatchup, manTarget, tokenCenter } from './fixtures';

/** Mean separation (yards) of one receiver at fixed playhead times, read from the separation overlay. */
async function separation(page: Page, label: string, times: number[]): Promise<number> {
  const values: number[] = [];
  for (const t of times) {
    await page.getByTestId('timeline-scrubber').fill(String(t));
    const text = await page.getByTestId(`sep-${label}`).textContent();
    values.push(Number.parseFloat(text ?? ''));
  }
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// Scenario 5: CB1 set to the weak level -> the receiver CB1 covers gets more separation.
// The engine is deterministic for a fixed seed (noise off), so no averaging over seeds is needed.
test('05 CB1 set to weak increases the separation of its receiver', async ({ page }) => {
  await createMatchup(page, SEED.flood, SEED.cover1);
  const times = [2, 2.5];

  const { label } = await manTarget(page);
  const before = await separation(page, label, times);

  const cb = await tokenCenter(page, 'CB1');
  await page.mouse.click(cb.x, cb.y);
  await page.getByTestId('level-weak').click();
  await expect(page.getByTestId('level-weak')).toHaveAttribute('aria-pressed', 'true');

  // The simulation re-runs asynchronously: poll until the new result is on screen.
  await expect.poll(() => separation(page, label, times), { timeout: 15_000 }).toBeGreaterThan(before);
});

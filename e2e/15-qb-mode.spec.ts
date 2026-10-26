import { expect, test } from '@playwright/test';
import { SEED, createMatchup, seekTo } from './fixtures';

// D-23 "QB tự ném": press a key at a chosen moment and get feedback on that throw.
test('15 QB mode: a key press throws to that read at the playhead time', async ({ page }) => {
  await createMatchup(page, SEED.flood, SEED.cover1);
  await page.getByTestId('qb-mode-toggle').check();
  await expect(page.getByTestId('qb-key-Y')).toHaveText('Q');

  // Pause and put the playhead at 1.5 s, then throw to read #4 (key R).
  const play = page.getByTestId('btn-play');
  if ((await play.getAttribute('aria-label'))?.toLowerCase().includes('dừng')) await play.click();
  await seekTo(page, 1.5);
  await page.keyboard.press('r');

  const panel = page.getByTestId('qb-mode-panel');
  await expect(panel).toContainText('1.50 s');
  await expect(page.getByTestId('qb-feedback-score')).toBeVisible();
  await expect(page.getByTestId('qb-feedback-best')).toBeVisible();
  await expect(page.getByTestId('timeline-time')).toHaveText('1.5 s');

  // After the ball lands the outcome is shown and the tally counts the attempt.
  await seekTo(page, 4);
  await expect(page.getByTestId('qb-feedback-outcome')).not.toContainText('…');
  await expect(page.getByTestId('qb-tally')).toContainText('1');

  // Retry clears the throw; leaving the mode restores the auto QB decision.
  await page.getByTestId('qb-retry').click();
  await page.getByTestId('qb-exit').click();
  await expect(page.getByTestId('qb-mode-panel')).toHaveCount(0);
});

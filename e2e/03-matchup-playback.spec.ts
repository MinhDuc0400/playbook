import { expect, test } from '@playwright/test';
import { createMatchup, createPlay, playToEnd, waitSavedAfterEdit } from './fixtures';

// Scenario 3: matchup from freshly created offense and defense plays, play to the end, see the outcome.
test('03 matchup plays to the end and shows an outcome', async ({ page }) => {
  const offenseId = await createPlay(page, { side: 'offense', formation: '2x1', name: 'E2E Offense' });
  await waitSavedAfterEdit(page);
  const defenseId = await createPlay(page, { side: 'defense', formation: 'Cover 1', name: 'E2E Defense' });
  await waitSavedAfterEdit(page);

  await createMatchup(page, offenseId, defenseId);
  await playToEnd(page);
  await expect(page.getByTestId('result-outcome').or(page.getByTestId('result-summary'))).not.toHaveText('');
});

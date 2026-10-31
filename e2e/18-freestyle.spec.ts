import { expect, test, type Page } from '@playwright/test';
import { SEED, activeTokens, buildFreestyleBoard, enableAdvanced, idFromUrl, tokenCenter } from './fixtures';

// FR-FS-01..16: Freestyle whiteboard. Desktop projects (chromium, webkit); phones are covered in 16-responsive.

const DRAFT_KEY = 'flagbook.freestyle.v1';

async function draftHasPlayers(page: Page): Promise<boolean> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    const d = JSON.parse(raw) as { offense: { players: unknown[] }; defense: { players: unknown[] } };
    return d.offense.players.length + d.defense.players.length > 0;
  }, DRAFT_KEY);
}

test('18 blank whiteboard: no players, run disabled with a hint, no dialog (FR-FS-01)', async ({ page }) => {
  await page.goto('/freestyle');
  await expect(page.getByTestId('field-svg')).toBeVisible();
  await expect.poll(() => activeTokens(page)).toBe(0);
  await expect(page.getByTestId('fs-run')).toBeDisabled();
  await expect(page.getByTestId('fs-hint')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('fs-save')).toBeDisabled();
});

test('18 build by tray, draw route and man, run, QB mode, edit, re-run (FR-FS-02..08, 16)', async ({
  page,
}) => {
  await buildFreestyleBoard(page);

  // Offense side: the defense we just placed is the passive layer; add a route to a WR.
  await page.getByTestId('fs-side-offense').click();
  await expect(page.getByTestId('passive-layer')).toBeAttached();
  await expect(page.getByTestId('tray-count-QB')).toHaveText('0');
  await page.getByTestId('tool-route').click();
  const wr = await tokenCenter(page, 'X');
  await page.mouse.click(wr.x, wr.y);
  await page.mouse.click(wr.x, wr.y - 120);
  await page.mouse.click(wr.x + 60, wr.y - 200);
  await page.keyboard.press('Enter');
  await page.getByTestId('tool-select').click();

  // Tab switches the side (Tab key outside inputs).
  await page.locator('body').click({ position: { x: 2, y: 2 } });
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('fs-side-defense')).toHaveAttribute('aria-pressed', 'true');

  // Man tool onto a real offense token.
  await page.getByTestId('tool-man').click();
  const cb = await tokenCenter(page, 'CB1');
  await page.mouse.click(cb.x, cb.y);
  await page.getByTestId('live-hit-X').click();
  await expect(page.getByTestId('man-CB1')).toBeVisible();
  await page.getByTestId('tool-select').click();

  // Run (button), then check the trial view.
  await expect(page.getByTestId('fs-run')).toBeEnabled();
  await page.getByTestId('fs-run').click();
  await expect(page.getByTestId('open-windows')).toBeVisible();
  const rows = page.locator('[data-testid^="ow-row-"]');
  await expect(rows.first()).toBeVisible();
  const before = await rows.count();
  expect(before).toBeGreaterThan(1);
  await expect(page.getByTestId('result-summary')).toBeVisible({ timeout: 20_000 });

  // QB mode: press a receiver key.
  await page.getByTestId('qb-mode-toggle').check();
  const key = page.locator('[data-testid^="qb-key-"]').first();
  await expect(key).toBeVisible();
  await page.keyboard.press('q');
  await page.keyboard.press('w');
  await expect(page.getByTestId('qb-feedback-score')).toBeVisible();

  // Back to editing: players intact.
  await page.getByTestId('fs-edit').click();
  await expect(page.getByTestId('fs-run')).toBeVisible();
  await expect.poll(() => activeTokens(page)).toBe(3);
  await page.getByTestId('fs-side-offense').click();
  await expect.poll(() => activeTokens(page)).toBe(4);

  // Remove one receiver, re-run: one fewer open-windows row.
  await page.getByTestId('tool-select').click();
  const x = await tokenCenter(page, 'Z');
  await page.mouse.click(x.x, x.y);
  await page.getByTestId('tray-remove').click();
  await expect.poll(() => activeTokens(page)).toBe(3);
  await page.getByTestId('fs-run').click();
  await expect(page.getByTestId('open-windows')).toBeVisible();
  await expect(rows).toHaveCount(before - 1);

  // Space returns via Esc, then Space runs again.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('fs-run')).toBeVisible();
  await page.locator('body').click({ position: { x: 2, y: 2 } });
  await page.keyboard.press(' ');
  await expect(page.getByTestId('fs-edit')).toBeVisible();
});

test('18 tray drag and drop places a player (FR-FS-16)', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'HTML5 drag-and-drop is only reliable in the chromium project');
  await page.goto('/freestyle');
  const box = (await page.getByTestId('field-svg').boundingBox())!;
  await page
    .getByTestId('tray-chip-QB')
    .dragTo(page.getByTestId('editor-canvas'), { targetPosition: { x: box.width / 2, y: box.height * 0.6 } });
  await expect.poll(() => activeTokens(page)).toBe(1);
  await expect(page.getByTestId('tray-count-QB')).toHaveText('0');
  await expect(page.getByTestId('tray-chip-QB')).toBeDisabled();
});

test('18 undo/redo across sides; Mới clears with a two-step confirm (FR-FS-08, FR-FS-11)', async ({
  page,
}) => {
  await buildFreestyleBoard(page); // defense side active, 4 offense + 3 defense
  await page.getByTestId('fs-undo').click();
  await expect.poll(() => activeTokens(page)).toBe(2);
  await page.getByTestId('fs-undo').click();
  await page.getByTestId('fs-undo').click();
  await expect.poll(() => activeTokens(page)).toBe(0);
  // Undo past the side switch lands on the offense side (history is shared).
  await page.getByTestId('fs-undo').click();
  await expect(page.getByTestId('fs-side-offense')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => activeTokens(page)).toBe(3);
  // Redo restores the state left by the last undo (defense side, blank) and the side follows it.
  await page.getByTestId('fs-redo').click();
  await expect(page.getByTestId('fs-side-defense')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => activeTokens(page)).toBe(0);
  for (let i = 0; i < 3; i++) await page.getByTestId('fs-redo').click();
  await expect.poll(() => activeTokens(page)).toBe(3);

  // Mới: first click asks, second clears both sides.
  await page.getByTestId('fs-clear').click();
  await expect(page.getByTestId('fs-clear')).toHaveText(/Bấm lần nữa/);
  await expect.poll(() => activeTokens(page)).toBe(3);
  await page.getByTestId('fs-clear').click();
  await expect.poll(() => activeTokens(page)).toBe(0);
  await page.getByTestId('fs-side-defense').click();
  await expect.poll(() => activeTokens(page)).toBe(0);
  await expect(page.getByTestId('fs-run')).toBeDisabled();
});

test('18 draft survives a reload; Mới leaves a blank board after reload (FR-FS-11)', async ({ page }) => {
  await buildFreestyleBoard(page);
  await expect.poll(() => draftHasPlayers(page)).toBe(true);
  await page.getByTestId('fs-side-offense').click();
  await expect.poll(() => activeTokens(page)).toBe(4);
  await page.waitForTimeout(800); // draft autosave debounce
  await page.reload();
  await expect(page.getByTestId('field-svg')).toBeVisible();
  await expect.poll(() => activeTokens(page)).toBe(4);
  await page.getByTestId('fs-side-defense').click();
  await expect.poll(() => activeTokens(page)).toBe(3);
  await expect(page.getByTestId('fs-run')).toBeEnabled();

  await page.getByTestId('fs-clear').click();
  await page.getByTestId('fs-clear').click();
  await expect.poll(() => activeTokens(page)).toBe(0);
  await page.reload();
  await expect(page.getByTestId('field-svg')).toBeVisible();
  await expect.poll(() => activeTokens(page)).toBe(0);
  await page.getByTestId('fs-side-offense').click();
  await expect.poll(() => activeTokens(page)).toBe(0);
});

test('18 Lưu thành play creates the matchup and two freestyle plays (FR-FS-10)', async ({ page }) => {
  await buildFreestyleBoard(page);
  await page.getByTestId('fs-save').click();
  await page.waitForURL(/\/matchup\/(?!new)[^/]+$/);
  expect(idFromUrl(page.url(), 'matchup')).toBeTruthy();
  await expect(page.getByTestId('open-windows')).toBeVisible({ timeout: 20_000 });

  await page.goto('/');
  const cards = page.locator('[data-testid^="card-"]').filter({ hasText: 'Freestyle' });
  await expect(cards).toHaveCount(2);
  await expect(cards.filter({ hasText: 'Tấn công' })).toHaveCount(1);
  await expect(cards.filter({ hasText: 'Phòng thủ' })).toHaveCount(1);
  await expect(page.getByTestId(`card-${SEED.smash}`)).toBeVisible();
});

test('18 nav item and Playbook button lead to Freestyle in Simple and Advanced mode (FR-FS-01)', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByTestId(`card-${SEED.smash}`)).toBeVisible();
  await expect(page.getByTestId('nav-freestyle')).toBeVisible();
  await page.getByTestId('playbook-freestyle').click();
  await expect(page).toHaveURL(/\/freestyle$/);
  await expect(page.getByTestId('fs-run')).toBeVisible();

  await enableAdvanced(page);
  await page.goto('/');
  await expect(page.getByTestId('nav-freestyle')).toBeVisible();
  await page.getByTestId('nav-freestyle').click();
  await expect(page).toHaveURL(/\/freestyle$/);
  await expect(page.getByTestId('fs-run')).toBeVisible();
});

test('18 viewport sizes: no horizontal overflow, field and buttons large enough (D-25)', async ({
  browser,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'viewport sweep runs once, in chromium');
  for (const width of [360, 390, 430, 768]) {
    const height = width === 768 ? 1024 : 800;
    // A fresh context per size keeps the saved draft of the previous size out of the way.
    const ctx = await browser.newContext({ viewport: { width, height }, baseURL: 'http://localhost:4173' });
    const page = await ctx.newPage();
    await buildFreestyleBoard(page);
    const sw = () => page.evaluate(() => ({ s: document.documentElement.scrollWidth, w: window.innerWidth }));
    const edit = await sw();
    expect(edit.s, `edit ${width}`).toBeLessThanOrEqual(edit.w + 1);
    const field = await page.getByTestId('freestyle-field').boundingBox();
    expect(field!.height, `field ${width}`).toBeGreaterThanOrEqual(height * 0.5 - 1);
    expect((await page.getByTestId('fs-run').boundingBox())!.height).toBeGreaterThanOrEqual(40);
    await page.getByTestId('fs-side-offense').click();
    await page.getByTestId('fs-run').click();
    await expect(page.getByTestId('open-windows')).toBeVisible();
    const trial = await sw();
    expect(trial.s, `trial ${width}`).toBeLessThanOrEqual(trial.w + 1);
    const tf = await page.getByTestId('freestyle-field').boundingBox();
    expect(tf!.height, `trial field ${width}`).toBeGreaterThanOrEqual(height * 0.5 - 1);
    expect((await page.getByTestId('fs-edit').boundingBox())!.height).toBeGreaterThanOrEqual(40);
    await ctx.close();
  }
});

test('18 the tray scrolls inside itself on a narrow screen (D-25)', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'viewport sweep runs once, in chromium');
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/freestyle');
  const tray = page.getByTestId('player-tray');
  await expect(tray).toBeVisible();
  const m = await tray.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }));
  expect(m.sw).toBeGreaterThan(m.cw);
  const page360 = await page.evaluate(() => ({
    s: document.documentElement.scrollWidth,
    w: window.innerWidth,
  }));
  expect(page360.s).toBeLessThanOrEqual(page360.w + 1);
  await tray.evaluate((el) => (el.scrollLeft = 80));
  expect(await tray.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
});

test('18 live re-run split: edits update the open windows without pressing run (FR-FS-06)', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'split view check runs once, in chromium');
  await page.setViewportSize({ width: 1280, height: 800 });
  await buildFreestyleBoard(page);
  // A route for X so the defense matters, then back to the defense side.
  await page.getByTestId('fs-side-offense').click();
  await page.getByTestId('tool-route').click();
  const wr = await tokenCenter(page, 'X');
  await page.mouse.click(wr.x, wr.y);
  await page.mouse.click(wr.x, wr.y - 120);
  await page.mouse.click(wr.x + 60, wr.y - 200);
  await page.keyboard.press('Enter');
  await page.getByTestId('tool-select').click();
  await page.getByTestId('fs-side-defense').click();

  await page.getByTestId('fs-live').check();
  const pane = page.getByTestId('freestyle-live');
  await expect(pane.getByTestId('open-windows')).toBeVisible();
  const windows = pane.getByTestId('open-windows');
  const field = page.getByTestId('editor-canvas').getByTestId('field-svg');
  const before = (await windows.textContent()) ?? '';
  const wrRows = await pane.locator('[data-testid^="ow-row-"]').count();

  // The editor stays on the left; the result pane sits to its right and is wide enough to read.
  const fieldBox = await field.boundingBox();
  const paneBox = await pane.boundingBox();
  expect(paneBox!.x).toBeGreaterThan(fieldBox!.x);
  expect(paneBox!.width).toBeGreaterThanOrEqual(1280 * 0.28);

  // Change the defense: drop defenders on X's route (no click on fs-run).
  for (const [dx, dy] of [
    [0, -110],
    [60, -190],
  ] as const) {
    const chip = page.getByTestId('tray-chip-LB');
    if ((await chip.getAttribute('aria-pressed')) !== 'true') await chip.click();
    await page.mouse.click(wr.x + dx, wr.y + dy);
  }
  await expect.poll(async () => (await windows.textContent()) ?? '', { timeout: 10_000 }).not.toBe(before);

  // Offense edit: removing a WR drops a row. The playhead keeps its place meanwhile.
  await pane.getByTestId('timeline-scrubber').focus();
  await page.keyboard.press('ArrowRight');
  const time = await pane.getByTestId('timeline-time').textContent();
  await page.getByTestId('fs-side-offense').click();
  await page.getByTestId('editor-canvas').getByTestId('token-C').locator('[data-part="body"]').click();
  await page.getByTestId('tray-remove').click();
  await expect(pane.locator('[data-testid^="ow-row-"]')).toHaveCount(wrRows - 1);
  expect(await pane.getByTestId('timeline-time').textContent()).toBe(time);

  // fs-run still opens the full-screen trial; the page never overflows horizontally.
  const m = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, w: window.innerWidth }));
  expect(m.s).toBeLessThanOrEqual(m.w + 1);
  await page.getByTestId('fs-run').click();
  await expect(page.getByTestId('freestyle-trial')).toBeVisible();
  await expect(page.getByTestId('freestyle-live')).toHaveCount(0);
});

test('18 the live toggle is not offered below 1024 (FR-FS-06)', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'viewport sweep runs once, in chromium');
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/freestyle');
  await expect(page.getByTestId('fs-run')).toBeVisible();
  await expect(page.getByTestId('fs-live')).toHaveCount(0);
});

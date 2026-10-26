import { expect, type Page } from '@playwright/test';

export const SEED = {
  flood: 'seed-off-trips-flood',
  mesh: 'seed-off-mesh',
  smash: 'seed-off-smash',
  cover1: 'seed-def-cover-1',
  cover2: 'seed-def-cover-2',
  cover3: 'seed-def-cover-3',
} as const;

/** Waits until the editor auto-save reports the saved state. */
export async function waitSaved(page: Page, testId = 'save-status'): Promise<void> {
  await expect(page.getByTestId(testId)).toHaveText('Đã lưu', { timeout: 15_000 });
}

/**
 * Waits for the auto-save that follows an edit: first the dirty state appears, then it settles on saved.
 * (Plain waitSaved would pass at once on the initial "saved" label, before the debounced write ran.)
 */
export async function waitSavedAfterEdit(page: Page, testId = 'save-status'): Promise<void> {
  await expect(page.getByTestId(testId)).not.toHaveText('Đã lưu');
  await waitSaved(page, testId);
}

/** Plays id from a `/play/<id>` URL. */
export function idFromUrl(url: string, kind: 'play' | 'matchup' | 'install'): string {
  const m = new RegExp(`/${kind}/([^/?#]+)`).exec(url);
  if (!m?.[1]) throw new Error(`no ${kind} id in ${url}`);
  return m[1];
}

/** Creates a play through the new-play dialog; returns its id once the editor is loaded. */
export async function createPlay(
  page: Page,
  opts: { side: 'offense' | 'defense'; formation: string; name: string },
): Promise<string> {
  await page.goto('/play/new');
  await page.getByTestId(`new-play-side-${opts.side}`).check();
  await page.getByTestId('new-play-format').selectOption('5v5');
  await page.getByTestId('new-play-formation').selectOption({ label: opts.formation });
  await page.getByTestId('new-play-create').click();
  await page.waitForURL(/\/play\/(?!new)[^/]+$/);
  await expect(page.getByTestId('editor-page')).toBeVisible();
  const id = idFromUrl(page.url(), 'play');
  await page.getByTestId('play-name').fill(opts.name);
  return id;
}

/** Creates a matchup through the dialog (prefilled by query); returns its id. */
export async function createMatchup(page: Page, offenseId: string, defenseId: string): Promise<string> {
  await page.goto(`/matchup/new?offense=${offenseId}&defense=${defenseId}`);
  const create = page.getByTestId('new-matchup-create');
  await expect(create).toBeEnabled();
  await create.click();
  await page.waitForURL(/\/matchup\/(?!new)[^/]+$/);
  await expect(page.getByTestId('matchup-field')).toBeVisible();
  await expect(page.getByTestId('result-outcome')).toBeVisible({ timeout: 20_000 });
  await waitSaved(page, 'matchup-save-status');
  return idFromUrl(page.url(), 'matchup');
}

/** Centre of an element in page coordinates. */
export async function centerOf(page: Page, testId: string): Promise<{ x: number; y: number }> {
  const box = await page.getByTestId(testId).boundingBox();
  if (!box) throw new Error(`no box for ${testId}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Centre of a token's body shape (the label text of defense tokens would skew the group's box). */
export async function tokenCenter(page: Page, label: string): Promise<{ x: number; y: number }> {
  const box = await page.getByTestId(`token-${label}`).locator('[data-part="body"]').boundingBox();
  if (!box) throw new Error(`no body for token ${label}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Label of the offense token whose centre is closest to the end of the CB1 man line, plus that distance. */
export async function manTarget(page: Page): Promise<{ label: string; dist: number }> {
  return page.evaluate(() => {
    const line = document.querySelector('[data-testid="overlay-man-CB1"] [data-part="line"]');
    const d = line?.getAttribute('d') ?? '';
    const nums = (d.match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g) ?? []).map(Number);
    const end = { x: nums[nums.length - 2] ?? NaN, y: nums[nums.length - 1] ?? NaN };
    let best = { label: '', dist: Infinity };
    for (const g of document.querySelectorAll('[data-testid="matchup-field"] [data-kind="player"]')) {
      const label = g.getAttribute('aria-label') ?? '';
      const c = g.querySelector('circle[data-part="body"]');
      if (!c) continue; // defense tokens are triangles
      const dist = Math.hypot(Number(c.getAttribute('cx')) - end.x, Number(c.getAttribute('cy')) - end.y);
      if (dist < best.dist) best = { label, dist };
    }
    return best;
  });
}

/** Plays the matchup timeline to its end. */
export async function playToEnd(page: Page): Promise<void> {
  await page.getByTestId('btn-play').click();
  await expect
    .poll(
      () =>
        page.getByTestId('timeline-scrubber').evaluate((el) => {
          const i = el as HTMLInputElement;
          return Number(i.max) > 0 && Number(i.value) >= Number(i.max) - 0.05;
        }),
      { timeout: 30_000 },
    )
    .toBe(true);
}

/** Sets the playback scrubber to `t` seconds (range inputs can't be filled). */
export async function seekTo(page: Page, t: number): Promise<void> {
  await page.getByTestId('timeline-scrubber').evaluate((el, value) => {
    const input = el as HTMLInputElement;
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    set?.call(input, String(value));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, t);
}

/** Starts a requestAnimationFrame recorder in the page (timestamps in ms). */
export async function startFrameRecorder(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __frames: { stop: boolean; ts: number[] } };
    w.__frames = { stop: false, ts: [] };
    const loop = (t: number): void => {
      w.__frames.ts.push(t);
      if (!w.__frames.stop) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
}

/** Stops the recorder; returns the frame intervals (ms) between consecutive rAF callbacks. */
export async function stopFrameRecorder(page: Page): Promise<number[]> {
  const ts = await page.evaluate(() => {
    const w = window as unknown as { __frames: { stop: boolean; ts: number[] } };
    w.__frames.stop = true;
    return w.__frames.ts;
  });
  return ts.slice(1).map((t, i) => t - (ts[i] ?? t));
}

/** q-quantile (0..1) of a numeric list. */
export function quantile(values: number[], q: number): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? NaN;
}

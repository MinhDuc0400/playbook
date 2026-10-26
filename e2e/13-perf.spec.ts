import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import {
  SEED,
  createMatchup,
  createPlay,
  quantile,
  startFrameRecorder,
  stopFrameRecorder,
  tokenCenter,
} from './fixtures';

const log = (name: string, browser: string, data: Record<string, number>): void => {
  const parts = Object.entries(data).map(([k, v]) => `${k}=${v.toFixed(1)}`);
  console.log(`[perf] ${name} (${browser}): ${parts.join(' ')}`);
};

// NFR-PERF-04: first open, production build, fresh profile: seed + grid with 6 cards in < 2 s.
test('13 first open shows 6 cards in under 2 s', async ({ browser, browserName }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  try {
    const page = await ctx.newPage();
    const t0 = Date.now();
    await page.goto('/');
    await page.waitForFunction(
      () => document.querySelector('[data-testid="playbook-grid"]')?.children.length === 6,
    );
    const ms = Date.now() - t0;
    log('first-open', browserName, { ms });
    expect(ms).toBeLessThan(2000);
  } finally {
    await ctx.close();
  }
});

// NFR-PERF-04: 500 plays, typing in the search box updates the grid in < 100 ms.
test('13 filtering 500 plays takes under 100 ms', async ({ page, browserName }, testInfo) => {
  test.setTimeout(120_000);
  // Export the seed, clone one play 500 times, import (merge) through the Settings UI.
  await page.goto('/settings');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('btn-export').click(),
  ]);
  const exported = testInfo.outputPath('seed-export.json');
  await download.saveAs(exported);
  const file = JSON.parse(readFileSync(exported, 'utf8')) as {
    data: { plays: Array<Record<string, unknown>> } & Record<string, unknown>;
  } & Record<string, unknown>;
  const base = file.data.plays.find((p) => p['id'] === SEED.flood)!;
  const plays = Array.from({ length: 500 }, (_, i) => ({
    ...base,
    id: `perf-${i}`,
    name: `Perf Play ${String(i).padStart(4, '0')}`,
  }));
  const big = testInfo.outputPath('plays-500.json');
  writeFileSync(big, JSON.stringify({ ...file, data: { plays } }));

  await page.getByTestId('import-file').setInputFiles(big);
  await page.getByTestId('import-mode-merge').check();
  await page.getByTestId('btn-import').click();
  await expect(page.getByTestId('import-report')).toBeVisible({ timeout: 60_000 });

  await page.goto('/');
  await page.waitForFunction(
    () => (document.querySelector('[data-testid="playbook-grid"]')?.children.length ?? 0) >= 500,
    undefined,
    { timeout: 30_000 },
  );

  const ms = await page.evaluate(async () => {
    const input = document.querySelector<HTMLInputElement>('[data-testid="filter-search"]')!;
    const grid = (): number => document.querySelector('[data-testid="playbook-grid"]')?.children.length ?? 0;
    const frame = (): Promise<number> => new Promise((r) => requestAnimationFrame(r));
    await frame();
    const t0 = performance.now();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setter.call(input, 'Perf Play 0123');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    for (let i = 0; i < 600 && grid() !== 1; i++) await frame();
    const end = await frame();
    return grid() === 1 ? end - t0 : -1;
  });
  log('filter-500', browserName, { ms });
  expect(ms).toBeGreaterThan(0);
  expect(ms).toBeLessThan(100);
});

// NFR-PERF-03: 50 runs in the Worker < 1.5 s, main thread stays responsive.
test('13 run 50 finishes under 1.5 s without freezing the UI', async ({ page, browserName }) => {
  await createMatchup(page, SEED.flood, SEED.cover1);
  await startFrameRecorder(page);
  await page.waitForTimeout(200);
  const ms = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const t0 = performance.now();
        const done = (): void => {
          obs.disconnect();
          resolve(performance.now() - t0);
        };
        const obs = new MutationObserver(() => {
          if (document.querySelector('[data-testid="run-many-result"]')) done();
        });
        obs.observe(document.body, { childList: true, subtree: true });
        document.querySelector<HTMLElement>('[data-testid="run-many"]')!.click();
      }),
  );
  const gaps = await stopFrameRecorder(page);
  const maxGap = Math.max(...gaps);
  log('run-50', browserName, { ms, maxFrameGap: maxGap });
  expect(ms).toBeLessThan(1500);
  expect(maxGap).toBeLessThan(200);
});

// NFR-PERF-01: dragging a token in the editor keeps the frame rate smooth.
test('13 dragging a token keeps frames smooth', async ({ page, browserName }) => {
  await createPlay(page, { side: 'offense', formation: 'Trips', name: 'E2E Drag' });
  const c = await tokenCenter(page, 'Y');
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.waitForTimeout(100);
  await startFrameRecorder(page);
  for (let i = 1; i <= 60; i++) {
    await page.mouse.move(c.x - i * 6, c.y - i * 3);
  }
  await page.waitForTimeout(100);
  const intervals = await stopFrameRecorder(page);
  await page.mouse.up();
  const median = quantile(intervals, 0.5);
  const p95 = quantile(intervals, 0.95);
  log('drag', browserName, { frames: intervals.length, median, p95 });
  expect(median).toBeLessThanOrEqual(20);
  // WebKit headless records only ~15 frames during the drag, so its p95 is noisy (24–38 ms observed).
  expect(p95).toBeLessThanOrEqual(browserName === 'webkit' ? 50 : 34);
});

import { describe, expect, it } from 'vitest';
import { simulateMany } from '@/engine/aggregate';
import { cover3Play, floodPlay, makeInput } from '@/engine/__tests__/fixtures';
import { runMany } from '../simClient';

const input = makeInput(floodPlay(), cover3Play(), { noise: true, seed: 2 });
input.tuning.maxTime = 6;

describe('simClient fallback (no Worker)', () => {
  it('resolves with the same aggregate as simulateMany and reports progress', async () => {
    const progress: [number, number][] = [];
    const { promise } = runMany(input, 6, (d, n) => progress.push([d, n]));
    const res = await promise;
    expect(res).toEqual(simulateMany(input, 6));
    expect(progress).toHaveLength(6);
    expect(progress[5]).toEqual([6, 6]);
  });

  it('cancel rejects with an AbortError and stops further work', async () => {
    const progress: number[] = [];
    const { promise, cancel } = runMany(input, 30, (d) => progress.push(d));
    await new Promise((r) => setTimeout(r, 15));
    cancel();
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    const n = progress.length;
    await new Promise((r) => setTimeout(r, 30));
    expect(progress.length).toBe(n);
    expect(n).toBeLessThan(30);
  });
});

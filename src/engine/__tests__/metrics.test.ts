import { describe, expect, it } from 'vitest';
import type { Frame, ID, Point } from '@/domain/types';
import { computeMetrics } from '../metrics';

function frame(t: number, pos: Record<ID, Point>): Frame {
  const players: Frame['players'] = {};
  for (const [id, p] of Object.entries(pos)) players[id] = { pos: p, vel: { x: 0, y: 0 }, state: 'idle' };
  return { t, players, ball: { state: 'held', pos: { x: 0, y: 0 } } };
}

/** r1 sits at the origin; d1 walks away 1 yd per frame; d2 is far away. */
function frames(): Frame[] {
  const out: Frame[] = [];
  for (let k = 0; k < 8; k++) {
    out.push(
      frame(k / 30, { r1: { x: 0, y: 0 }, d1: { x: k, y: 0 }, d2: { x: 100, y: 0 }, r2: { x: 50, y: 0 } }),
    );
  }
  return out;
}

describe('computeMetrics', () => {
  it('separation per frame is the distance to the nearest defender', () => {
    const m = computeMetrics(frames(), ['r1'], ['d1', 'd2'], undefined, 2.5);
    const sep = m.separation['r1'] as { t: number; d: number }[];
    expect(sep).toHaveLength(8);
    expect(sep.map((s) => s.d)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(sep[3]?.t).toBeCloseTo(3 / 30);
  });

  it('openWindows are maximal intervals with separation >= threshold', () => {
    const m = computeMetrics(frames(), ['r1'], ['d1', 'd2'], undefined, 2.5);
    expect(m.openWindows['r1']).toEqual([[3 / 30, 7 / 30]]);
  });

  it('openWindows splits into several intervals and closes at the last frame', () => {
    const fs: Frame[] = [0, 5, 5, 1, 1, 6, 6].map((x, k) =>
      frame(k / 30, { r1: { x: 0, y: 0 }, d1: { x, y: 0 } }),
    );
    const m = computeMetrics(fs, ['r1'], ['d1'], undefined, 2.5);
    expect(m.openWindows['r1']).toEqual([
      [1 / 30, 2 / 30],
      [5 / 30, 6 / 30],
    ]);
  });

  it('no window when never open', () => {
    const m = computeMetrics(frames().slice(0, 3), ['r1'], ['d1'], undefined, 2.5);
    expect(m.openWindows['r1']).toEqual([]);
  });

  it('separationAtThrow and timeToThrow only when thrown; uses the nearest frame', () => {
    const none = computeMetrics(frames(), ['r1', 'r2'], ['d1', 'd2'], undefined, 2.5);
    expect(none.separationAtThrow).toBeUndefined();
    expect(none.timeToThrow).toBeUndefined();

    const m = computeMetrics(frames(), ['r1', 'r2'], ['d1', 'd2'], 4.2 / 30, 2.5);
    expect(m.timeToThrow).toBeCloseTo(4.2 / 30);
    expect(m.separationAtThrow?.['r1']).toBe(4);
    expect(m.separationAtThrow?.['r2']).toBe(46); // d1 at x = 4 is nearer than d2 at x = 100
  });
});

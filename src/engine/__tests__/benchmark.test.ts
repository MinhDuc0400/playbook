import { describe, expect, it } from 'vitest';
import { createDefaultSettings } from '@/domain/defaults';
import { isTargetPair, runBenchmark } from '../benchmark';
import { floodPlay, cover3Play } from './fixtures';

describe('FR-TUN-03 benchmark runner', () => {
  it('runs every offense × defense pair of the same format and flags target pairs', () => {
    const rows = runBenchmark(
      [
        { ...floodPlay(), tags: ['beats:cover-3'] },
        { ...cover3Play(), tags: ['cov:cover-3'] },
      ],
      createDefaultSettings(),
      10,
    );
    expect(rows).toHaveLength(1);
    const r = rows[0]!;
    expect(r.runs).toBe(10);
    expect(r.pComplete).toBeGreaterThanOrEqual(0);
    expect(r.pComplete).toBeLessThanOrEqual(1);
    expect(r.target).toBe(true);
  });

  it('isTargetPair matches beats:cover-N with cov:cover-N only', () => {
    const o = { ...floodPlay(), tags: ['beats:cover-3', 'beats:man'] };
    expect(isTargetPair(o, { ...cover3Play(), tags: ['cov:cover-3'] })).toBe(true);
    expect(isTargetPair(o, { ...cover3Play(), tags: ['cov:cover-2', 'cov:man'] })).toBe(false);
  });

  it('is deterministic', () => {
    const a = runBenchmark([floodPlay(), cover3Play()], createDefaultSettings(), 5);
    const b = runBenchmark([floodPlay(), cover3Play()], createDefaultSettings(), 5);
    expect(a).toEqual(b);
  });
});

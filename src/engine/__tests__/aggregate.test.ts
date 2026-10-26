import { describe, expect, it } from 'vitest';
import type { OutcomeKind } from '@/domain/types';
import { aggregate, receiverIdsOf, simulateMany } from '../aggregate';
import { simulate } from '../simulate';
import { cover3Play, floodPlay, makeInput } from './fixtures';

const input = makeInput(floodPlay(), cover3Play(), { noise: true, seed: 11 });
input.tuning.maxTime = 6;

describe('aggregate / simulateMany (FR-ENG-11)', () => {
  const agg = simulateMany(input, 40);

  it('outcome counts sum to runs and probabilities are consistent', () => {
    expect(agg.runs).toBe(40);
    const total = Object.values(agg.outcomes).reduce((a, b) => a + b, 0);
    expect(total).toBe(40);
    expect(agg.pComplete).toBeCloseTo(agg.outcomes.complete / 40, 12);
    expect(agg.pSack).toBeCloseTo(agg.outcomes.sack / 40, 12);
    expect(agg.pInt).toBeCloseTo(agg.outcomes.intercepted / 40, 12);
    expect(agg.pComplete).toBeGreaterThan(0.2);
  });

  it('is deterministic and uses seeds seed + i', () => {
    expect(simulateMany(input, 40)).toEqual(agg);
    const manual = aggregate(
      Array.from({ length: 40 }, (_, i) => simulate({ ...input, seed: input.seed + i })),
      receiverIdsOf(input),
    );
    expect(manual).toEqual(agg);
  });

  it('target distribution and perTarget agree with the throws', () => {
    const throws = Object.values(agg.perTarget).reduce((a, p) => a + p.throws, 0);
    const dist = Object.values(agg.targetDistribution).reduce((a, b) => a + b, 0);
    expect(dist).toBeCloseTo(throws / 40, 12);
    const completes = Object.values(agg.perTarget).reduce((a, p) => a + p.completes, 0);
    expect(completes).toBe(agg.outcomes.complete);
    expect(Object.keys(agg.targetDistribution)).not.toContain('f-q');
    for (const p of Object.values(agg.perTarget)) {
      expect(p.completes).toBeLessThanOrEqual(p.throws);
      expect(p.avgSepAtThrow).toBeGreaterThanOrEqual(0);
    }
  });

  it('yards: avgYards = completions × avgYardsPerCompletion / runs; time to throw is positive', () => {
    expect(agg.avgYards).toBeCloseTo((agg.outcomes.complete * agg.avgYardsPerCompletion) / 40, 9);
    expect(agg.avgTimeToThrow).toBeGreaterThan(0.5);
    expect(Object.keys(agg.avgSeparationAtThrow).length).toBeGreaterThan(0);
  });

  it('reports progress once per run', () => {
    const seen: number[] = [];
    simulateMany(input, 5, (d) => seen.push(d));
    expect(seen).toEqual([1, 2, 3, 4, 5]);
  });

  it('empty input: zero runs, null time to throw', () => {
    const e = aggregate([], ['a']);
    expect(e.runs).toBe(0);
    expect(e.avgTimeToThrow).toBeNull();
    expect(e.pComplete).toBe(0);
    expect((Object.keys(e.outcomes) as OutcomeKind[]).length).toBe(7);
  });
});

describe('NFR-PERF-03', () => {
  it('simulateMany 50 < 1.5 s', () => {
    const play = makeInput(floodPlay(), cover3Play(), { noise: true, seed: 1 });
    simulateMany(play, 3);
    const t0 = performance.now();
    simulateMany(play, 50);
    const ms = performance.now() - t0;
    console.info(`NFR-PERF-03 simulateMany(50) ${ms.toFixed(0)} ms`);
    expect(ms).toBeLessThan(1500);
  });
});

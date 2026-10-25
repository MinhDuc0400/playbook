import { describe, expect, it } from 'vitest';
import { createRng, forkRng, gaussian, uniform } from '../rng';

const take = (rng: () => number, n: number): number[] => Array.from({ length: n }, () => rng());

describe('createRng (NFR-ARC-02, D-10)', () => {
  it('is deterministic per seed', () => {
    expect(take(createRng(42), 50)).toEqual(take(createRng(42), 50));
  });

  it('different seeds give different streams', () => {
    expect(take(createRng(1), 10)).not.toEqual(take(createRng(2), 10));
  });

  it('returns floats in [0, 1) with mean ~0.5 over 100k draws', () => {
    const rng = createRng(7);
    let sum = 0;
    for (let i = 0; i < 100_000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      sum += v;
    }
    expect(Math.abs(sum / 100_000 - 0.5)).toBeLessThan(0.01);
  });
});

describe('forkRng (D-10)', () => {
  it('same (seed, key) gives the same stream', () => {
    expect(take(forkRng(5, 'qb'), 30)).toEqual(take(forkRng(5, 'qb'), 30));
  });

  it('different keys give different streams', () => {
    expect(take(forkRng(5, 'qb'), 10)).not.toEqual(take(forkRng(5, 'wr1'), 10));
  });

  it('different seeds with the same key differ', () => {
    expect(take(forkRng(5, 'qb'), 10)).not.toEqual(take(forkRng(6, 'qb'), 10));
  });

  it('sibling streams are statistically independent (correlation ~0)', () => {
    const a = take(forkRng(9, 'o1'), 50_000);
    const b = take(forkRng(9, 'o2'), 50_000);
    const ma = a.reduce((s, v) => s + v, 0) / a.length;
    const mb = b.reduce((s, v) => s + v, 0) / b.length;
    let cov = 0;
    let va = 0;
    let vb = 0;
    for (let i = 0; i < a.length; i++) {
      cov += (a[i]! - ma) * (b[i]! - mb);
      va += (a[i]! - ma) ** 2;
      vb += (b[i]! - mb) ** 2;
    }
    expect(Math.abs(cov / Math.sqrt(va * vb))).toBeLessThan(0.02);
  });

  it('keys that differ by one character still diverge', () => {
    expect(take(forkRng(1, 'p1'), 5)).not.toEqual(take(forkRng(1, 'p2'), 5));
  });
});

describe('gaussian / uniform', () => {
  it('gaussian has mean ~0 and sd ~1 over 100k draws', () => {
    const rng = createRng(11);
    const n = 100_000;
    const xs = Array.from({ length: n }, () => gaussian(rng));
    const mean = xs.reduce((s, v) => s + v, 0) / n;
    const sd = Math.sqrt(xs.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
    expect(Math.abs(mean)).toBeLessThan(0.02);
    expect(Math.abs(sd - 1)).toBeLessThan(0.02);
  });

  it('gaussian stays finite when rng returns 0', () => {
    expect(Number.isFinite(gaussian(() => 0))).toBe(true);
  });

  it('uniform maps into [min, max)', () => {
    const rng = createRng(3);
    for (let i = 0; i < 1000; i++) {
      const v = uniform(rng, -2, 5);
      expect(v).toBeGreaterThanOrEqual(-2);
      expect(v).toBeLessThan(5);
    }
    expect(uniform(() => 0.5, 10, 20)).toBe(15);
  });
});

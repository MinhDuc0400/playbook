import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_TUNING } from '@/domain/defaults';
import type { TuningParams } from '@/domain/types';
import { resolveArrival, resolveContest, type ContestResult } from '../outcome';
import { createRng } from '../rng';

const N = 100_000;
const TOL = 0.01;
const T: TuningParams = { ...DEFAULT_TUNING, intShare: 1, contestShareExponent: 1 };

function tally(run: () => ContestResult): Record<ContestResult, number> {
  const c: Record<ContestResult, number> = { complete: 0, intercepted: 0, deflected: 0, incomplete: 0 };
  for (let i = 0; i < N; i++) c[run()]++;
  return c;
}

describe('resolveContest §8.8 100k', () => {
  it('touch cases: only-rec 20 %, only-def 15 %, both 60 %, none 5 %', () => {
    // Observe the two touch draws through a recording RNG.
    const rng = createRng(2024);
    let onlyRec = 0;
    let onlyDef = 0;
    let both = 0;
    let none = 0;
    for (let i = 0; i < N; i++) {
      const draws: number[] = [];
      const spy = (): number => {
        const v = rng();
        draws.push(v);
        return v;
      };
      resolveContest(0.8, 0.75, 1, 1, T, spy);
      const recOk = draws[0]! < 0.8;
      const defOk = draws[1]! < 0.75;
      if (recOk && defOk) both++;
      else if (recOk) onlyRec++;
      else if (defOk) onlyDef++;
      else none++;
    }
    expect(Math.abs(onlyRec / N - 0.2)).toBeLessThan(TOL);
    expect(Math.abs(onlyDef / N - 0.15)).toBeLessThan(TOL);
    expect(Math.abs(both / N - 0.6)).toBeLessThan(TOL);
    expect(Math.abs(none / N - 0.05)).toBeLessThan(TOL);
  });

  it.each([
    ['equal (recShare 0.5)', 1, 1, 0.5, 0.45],
    ['receiver closer (recShare 0.7)', 0.3, 0.7, 0.62, 0.33],
    ['defender closer (recShare 0.3)', 0.7, 0.3, 0.38, 0.57],
  ])('%s -> complete / INT / incomplete', (_n, recDist, defDist, complete, intercepted) => {
    const rng = createRng(99);
    const c = tally(() => resolveContest(0.8, 0.75, recDist, defDist, T, rng));
    expect(Math.abs(c.complete / N - complete)).toBeLessThan(TOL);
    expect(Math.abs(c.intercepted / N - intercepted)).toBeLessThan(TOL);
    expect(Math.abs(c.incomplete / N - 0.05)).toBeLessThan(TOL);
    expect(c.deflected).toBe(0);
  });

  it('intShare 0.4 splits defender wins 40 % INT / 60 % deflected', () => {
    const t = { ...T, intShare: 0.4 };
    const rng = createRng(5);
    const c = tally(() => resolveContest(0.8, 0.75, 1, 1, t, rng));
    // Defender wins = 0.15 + 0.60 * 0.5 = 0.45 of all trials.
    expect(Math.abs(c.intercepted / N - 0.45 * 0.4)).toBeLessThan(TOL);
    expect(Math.abs(c.deflected / N - 0.45 * 0.6)).toBeLessThan(TOL);
    expect(Math.abs(c.complete / N - 0.5)).toBeLessThan(TOL);
  });

  it('recShare is 0.5 when both distances are 0', () => {
    // hands = ballSkills = 1: recOk, defOk always true; third draw decides.
    expect(resolveContest(1, 1, 0, 0, T, seq([0, 0, 0.49]))).toBe('complete');
    expect(resolveContest(1, 1, 0, 0, T, seq([0, 0, 0.5]))).toBe('intercepted');
  });

  it('uses draw order recOk, defOk, recShare, intShare', () => {
    // both touch, rec loses recShare draw, intShare draw 0.1 < 1 -> intercepted
    const spy = vi.fn(seq([0.1, 0.1, 0.99, 0.1]));
    expect(resolveContest(0.8, 0.75, 1, 1, T, spy)).toBe('intercepted');
    expect(spy).toHaveBeenCalledTimes(4);
  });

  it('draws only two numbers when nobody or only the receiver touches', () => {
    const spy = vi.fn(seq([0.99, 0.99]));
    expect(resolveContest(0.8, 0.75, 1, 1, T, spy)).toBe('incomplete');
    expect(spy).toHaveBeenCalledTimes(2);
    const spy2 = vi.fn(seq([0.1, 0.99]));
    expect(resolveContest(0.8, 0.75, 1, 1, T, spy2)).toBe('complete');
    expect(spy2).toHaveBeenCalledTimes(2);
  });

  it('exponent k shifts the share toward the closer player', () => {
    const t = { ...T, contestShareExponent: 2 };
    // recDist 0.3, defDist 0.7: recShare = 0.49 / (0.09 + 0.49) ≈ 0.845
    expect(resolveContest(1, 1, 0.3, 0.7, t, seq([0, 0, 0.84]))).toBe('complete');
    expect(resolveContest(1, 1, 0.3, 0.7, t, seq([0, 0, 0.85, 0]))).toBe('intercepted');
  });
});

describe('resolveArrival (D-11)', () => {
  it('neither -> incomplete and rng is NOT called', () => {
    const spy = vi.fn(() => 0.5);
    expect(resolveArrival({ receiver: null, defender: null }, T, spy)).toBe('incomplete');
    expect(spy).not.toHaveBeenCalled();
  });

  it('receiver only: complete ≈ hands', () => {
    const rng = createRng(1);
    const c = tally(() =>
      resolveArrival({ receiver: { id: 'r', dist: 0.5, hands: 0.8 }, defender: null }, T, rng),
    );
    expect(Math.abs(c.complete / N - 0.8)).toBeLessThan(TOL);
    expect(c.incomplete + c.complete).toBe(N);
  });

  it('defender only: INT + deflect ≈ ballSkills, never complete', () => {
    const t = { ...T, intShare: 0.4 };
    const rng = createRng(2);
    const c = tally(() =>
      resolveArrival({ receiver: null, defender: { id: 'd', dist: 0.5, ballSkills: 0.75 } }, t, rng),
    );
    expect(c.complete).toBe(0);
    expect(Math.abs((c.intercepted + c.deflected) / N - 0.75)).toBeLessThan(TOL);
    expect(Math.abs(c.intercepted / N - 0.75 * 0.4)).toBeLessThan(TOL);
  });

  it('both: matches the full contest table', () => {
    const rng = createRng(3);
    const c = tally(() =>
      resolveArrival(
        {
          receiver: { id: 'r', dist: 1, hands: 0.8 },
          defender: { id: 'd', dist: 1, ballSkills: 0.75 },
        },
        T,
        rng,
      ),
    );
    expect(Math.abs(c.complete / N - 0.5)).toBeLessThan(TOL);
    expect(Math.abs(c.intercepted / N - 0.45)).toBeLessThan(TOL);
  });
});

/** Deterministic RNG returning the listed values in order (0 afterwards). */
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++] ?? 0;
}

/** D-23 manual QB control: no self-made decisions, throw at the pressed time, deterministic prefix. */
import { describe, expect, it } from 'vitest';
import type { SimResult } from '@/domain/types';
import { simulate } from '../simulate';
import { cover3Play, floodPlay, makeInput } from './fixtures';

const base = (over: Parameters<typeof makeInput>[2] = {}) =>
  makeInput(floodPlay(), cover3Play(), { seed: 3, noise: true, qbControl: 'manual', ...over });

const throwStart = (r: SimResult) => r.events.find((e) => e.type === 'throwStart');

describe('manual QB (D-23)', () => {
  const none = simulate(base());

  it('without a throw the QB never throws; scores are still reported', () => {
    expect(
      none.events.some((e) => e.type === 'throwStart' || e.type === 'throw' || e.type === 'throwaway'),
    ).toBe(false);
    expect(['sack', 'timeout']).toContain(none.outcome.kind);
    expect(none.metrics.reads?.decision.kind).toBe('none');
    expect(none.frames.some((f) => f.qb && Object.keys(f.qb.scores).length > 0)).toBe(true);
  });

  it('a manualThrow is ignored in auto mode', () => {
    const a = simulate(makeInput(floodPlay(), cover3Play(), { seed: 3, noise: true }));
    const b = simulate(
      makeInput(floodPlay(), cover3Play(), {
        seed: 3,
        noise: true,
        manualThrow: { targetId: 'f-z', t: 0.5 },
      }),
    );
    expect(b).toEqual(a);
  });

  it('throws to the target at the first tick >= t with decision kind manual', () => {
    const r = simulate(base({ manualThrow: { targetId: 'f-y', t: 1.5 } }));
    const ev = throwStart(r);
    expect(ev?.targetId).toBe('f-y');
    expect(ev?.t).toBeGreaterThanOrEqual(1.5 - 1e-9);
    expect(ev?.t).toBeLessThan(1.5 + 0.05);
    const dec = r.metrics.reads?.decision;
    expect(dec?.kind).toBe('manual');
    expect(dec?.targetId).toBe('f-y');
    expect(typeof dec?.score).toBe('number');
    expect(dec?.readIndex).toBe(r.metrics.reads?.windows.findIndex((w) => w.id === 'f-y'));
    expect(r.events.some((e) => e.type === 'throw' && e.targetId === 'f-y')).toBe(true);
    expect(['complete', 'incomplete', 'interception']).toContain(r.outcome.kind);
  });

  it('frames before t0 are identical to the no-throw run', () => {
    for (const t0 of [0.4, 1.1, 2.0]) {
      const r = simulate(base({ manualThrow: { targetId: 'f-h', t: t0 } }));
      const pre = r.frames.filter((f) => f.t < t0 - 1e-9);
      expect(pre.length).toBeGreaterThan(5);
      expect(pre).toEqual(none.frames.slice(0, pre.length));
      expect(throwStart(r)).toBeDefined();
    }
  });

  it('an invalid target becomes a throwaway at t0', () => {
    for (const targetId of ['f-q', 'nobody']) {
      const r = simulate(base({ manualThrow: { targetId, t: 1.2 } }));
      expect(throwStart(r)).toBeUndefined();
      const ev = r.events.find((e) => e.type === 'throwaway');
      expect(ev).toBeDefined();
      expect(r.metrics.reads?.decision.kind).toBe('throwaway');
    }
  });
});

import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_TUNING, createDefaultRoutePriors } from '@/domain/defaults';
import { distance } from '@/domain/geometry';
import type { Point } from '@/domain/types';
import {
  TEMPLATE_SPEED,
  createAnticipation,
  createRouteBelief,
  createTellState,
  priorKeyFor,
  templatePosAt,
} from '../anticipation';
import type { PerceivedPlayer } from '../types';

const tuning = { ...DEFAULT_TUNING };
const start: Point = { x: 10, y: -1 };
const priors = createDefaultRoutePriors();

function seenAt(pos: Point, vel: Point = { x: 0, y: 0 }): PerceivedPlayer {
  return { id: 'w', side: 'offense', role: 'WR', pos, vel };
}

describe('priorKeyFor', () => {
  it('maps number, backfield RB and sideline distance to the prior rows', () => {
    expect(priorKeyFor(null, true, 3)).toBe('rb');
    expect(priorKeyFor(1, false, 6)).toBe('n1-tight');
    expect(priorKeyFor(1, false, 6.1)).toBe('n1-wide');
    expect(priorKeyFor(2, false, 2)).toBe('n2-slot');
    expect(priorKeyFor(3, false, 2)).toBe('n3');
    expect(priorKeyFor(null, false, 2)).toBe('n3');
  });
});

describe('templatePosAt', () => {
  it('starts at the start point', () => {
    expect(templatePosAt('slant', start, 1, 0)).toEqual(start);
    expect(templatePosAt('slant', start, 1, -1)).toEqual(start);
  });

  it('slant goes up then inside; out goes up then outside; go goes straight up and continues', () => {
    const slantEnd = templatePosAt('slant', start, 1, 2);
    expect(slantEnd.x).toBeLessThan(start.x);
    expect(slantEnd.y).toBeGreaterThan(start.y);
    const outEnd = templatePosAt('out', start, 1, 2);
    expect(outEnd.x).toBeGreaterThan(start.x);
    const goEarly = templatePosAt('go', start, 1, 1);
    expect(goEarly.x).toBeCloseTo(start.x, 9);
    expect(goEarly.y).toBeCloseTo(start.y + TEMPLATE_SPEED, 9);
    // go has 16 yd default length path (depth 15 + 1): continue extends upfield beyond it.
    const goLate = templatePosAt('go', start, 1, 5);
    expect(goLate.y).toBeCloseTo(start.y + 5 * TEMPLATE_SPEED, 9);
  });

  it("'stop' routes stay at the end of the path", () => {
    const a = templatePosAt('hitch', start, 1, 5);
    const b = templatePosAt('hitch', start, 1, 9);
    expect(distance(a, b)).toBeLessThan(1e-9);
  });

  it('outward = -1 mirrors lateral movement', () => {
    const r = templatePosAt('out', start, 1, 2);
    const l = templatePosAt('out', start, -1, 2);
    expect(l.x - start.x).toBeCloseTo(-(r.x - start.x), 9);
    expect(l.y).toBeCloseTo(r.y, 9);
  });
});

describe('route belief', () => {
  const prior = priors['n1-wide'] as Record<string, number>;

  it('probabilities sum to 1 before and after observations', () => {
    const b = createRouteBelief({ start, outward: 1, prior });
    const sum = () => Object.values(b.probabilities()).reduce((a, c) => a + c, 0);
    expect(sum()).toBeCloseTo(1, 9);
    b.observe(templatePosAt('slant', start, 1, 0.5), 0.5);
    expect(sum()).toBeCloseTo(1, 9);
  });

  it('observing a slant raises P(slant) above its prior and lowers non-matching routes', () => {
    const b = createRouteBelief({ start, outward: 1, prior });
    const before = b.probabilities();
    for (let t = 0.1; t <= 1.0001; t += 0.1) b.observe(templatePosAt('slant', start, 1, t), t);
    const after = b.probabilities();
    expect(after['slant'] as number).toBeGreaterThan(before['slant'] as number);
    expect(after['out'] as number).toBeLessThan(before['out'] as number);
    expect(after['go'] as number).toBeLessThan(before['go'] as number);
    // never ruled out completely
    for (const v of Object.values(after)) expect(v).toBeGreaterThan(0);
  });

  it('expectedPosAt is the probability-weighted mix of template positions', () => {
    const b = createRouteBelief({ start, outward: 1, prior });
    const probs = b.probabilities();
    let x = 0;
    let y = 0;
    for (const [id, p] of Object.entries(probs)) {
      const q = templatePosAt(id as Parameters<typeof templatePosAt>[0], start, 1, 1.5);
      x += p * q.x;
      y += p * q.y;
    }
    const e = b.expectedPosAt(1.5);
    expect(e.x).toBeCloseTo(x, 9);
    expect(e.y).toBeCloseTo(y, 9);
  });

  it('a degenerate belief that is certain about a route yields that route', () => {
    const b = createRouteBelief({ start, outward: 1, prior: { go: 1 } });
    const e = b.expectedPosAt(1);
    const g = templatePosAt('go', start, 1, 1);
    expect(distance(e, g)).toBeLessThan(1e-9);
  });
});

describe('model.aim (SRS 8.7 lerps)', () => {
  const receivers = [
    { id: 'w', start, outward: 1 as const, key: 'n1-wide' as const, side: 'right' as const },
  ];
  const seen = seenAt({ x: 10, y: 3 }, { x: 0, y: 5 });
  const t = 1;
  const la = tuning.lookahead;
  const truth: Point = { x: 4, y: 12 };

  function build(a: number, oracle: ((id: string, t: number) => Point | undefined) | null) {
    return createAnticipation({ a, priors, receivers, oracle });
  }
  const lerp = (p: Point, q: Point, k: number): Point => ({
    x: p.x + (q.x - p.x) * k,
    y: p.y + (q.y - p.y) * k,
  });
  const reactive: Point = { x: seen.pos.x + seen.vel.x * la, y: seen.pos.y + seen.vel.y * la };

  it.each([1, 0.5])('matches the spec formula at every a (iq %s)', (iq) => {
    for (const a of [0, 0.25, 0.5, 0.75, 1]) {
      const m = build(a, () => truth);
      const belief = m.createBelief('w');
      const prior = belief ? belief.expectedPosAt(t + la) : reactive;
      let expected: Point;
      if (a <= 0.5) expected = lerp(reactive, a > 0 ? prior : reactive, (a / 0.5) * iq);
      else expected = lerp(lerp(reactive, prior, iq), truth, (a - 0.5) / 0.5);
      const got = m.aim(seen, belief, t, iq, tuning);
      expect(got.x).toBeCloseTo(expected.x, 9);
      expect(got.y).toBeCloseTo(expected.y, 9);
    }
  });

  it('a = 0 is exactly reactive; a = 1 with iq any is exactly the oracle', () => {
    const m0 = build(0, () => truth);
    expect(m0.aim(seen, m0.createBelief('w'), t, 1, tuning)).toEqual(reactive);
    const m1 = build(1, () => truth);
    const o = m1.aim(seen, m1.createBelief('w'), t, 0.3, tuning);
    expect(o.x).toBeCloseTo(truth.x, 9);
    expect(o.y).toBeCloseTo(truth.y, 9);
  });

  it('never calls the oracle when a <= 0.5', () => {
    const spy = vi.fn(() => truth);
    for (const a of [0, 0.3, 0.5]) {
      const m = build(a, spy);
      expect(m.oracleEnabled).toBe(false);
      m.aim(seen, m.createBelief('w'), t, 1, tuning);
    }
    expect(spy).not.toHaveBeenCalled();
    const m = build(0.8, spy);
    expect(m.oracleEnabled).toBe(true);
    m.aim(seen, m.createBelief('w'), t, 1, tuning);
    expect(spy).toHaveBeenCalledWith('w', t + la);
  });

  it('createBelief is null when reading is off or the receiver is unknown', () => {
    expect(build(0, null).createBelief('w')).toBeNull();
    expect(build(0.5, null).createBelief('zz')).toBeNull();
    expect(build(0.5, null).createBelief('w')).not.toBeNull();
  });

  it('falls back to the default prior row when the table lacks it', () => {
    const m = createAnticipation({ a: 0.5, priors: {}, receivers, oracle: null });
    const sum = Object.values(
      (m.createBelief('w') as NonNullable<ReturnType<typeof m.createBelief>>).probabilities(),
    );
    expect(sum.reduce((a, c) => a + c, 0)).toBeCloseTo(1, 9);
  });
});

describe('tellFactor', () => {
  const receivers = [
    { id: 'w', start, outward: 1 as const, key: 'n1-wide' as const, side: 'right' as const },
  ];
  const model = (a: number) => createAnticipation({ a, priors, receivers, oracle: null });
  const slow = seenAt({ x: 0, y: 0 }, { x: 0, y: 4 });
  const fast = seenAt({ x: 0, y: 0 }, { x: 0, y: 7 });

  it('returns 0.5 only with reading enabled + deceleration + rng < iq', () => {
    expect(model(0.5).tellFactor(createTellState(), slow, 7, 0.8, () => 0.1)).toBe(0.5);
    expect(model(0).tellFactor(createTellState(), slow, 7, 0.8, () => 0.1)).toBe(1);
    expect(model(0.5).tellFactor(createTellState(), fast, 7, 0.8, () => 0.1)).toBe(1);
    expect(model(0.5).tellFactor(createTellState(), slow, 7, 0.8, () => 0.9)).toBe(1);
    expect(model(0.5).tellFactor(createTellState(), slow, null, 0.8, () => 0.1)).toBe(1);
  });

  it('draws once per episode and holds the factor for the episode', () => {
    const rng = vi.fn(() => 0.1);
    const m = model(0.5);
    const st = createTellState();
    expect(m.tellFactor(st, slow, 7, 0.8, rng)).toBe(0.5);
    expect(m.tellFactor(st, fast, 7, 0.8, rng)).toBe(0.5);
    expect(rng).toHaveBeenCalledTimes(1);
  });
});

import { describe, expect, it } from 'vitest';
import {
  LEVERAGE_BREAK_SPEED,
  buildPerception,
  effectiveDelay,
  type Roster,
  type Viewer,
} from '../perception';
import { createHistory, pushSnapshot, type Snapshot } from '../world';

const DT = 1 / 60;
const REACTION = 0.35;
const FACTOR = 0.3;

const roster: Roster = {
  players: {
    qb: { side: 'offense', role: 'QB' },
    wr: { side: 'offense', role: 'WR', number: { kind: 'number', side: 'strong', number: 1 } },
    rb: { side: 'offense', role: 'RB', number: { kind: 'role', role: 'RB' } },
    cb: { side: 'defense', role: 'CB' },
  },
};

/** wr runs along y with constant vx; qb stands; cb stands. Linear motion so interpolation is exact. */
function build(opts: { vx?: number; x0?: number; end?: number; throwAt?: number } = {}) {
  const vx = opts.vx ?? 0;
  const x0 = opts.x0 ?? 10;
  const end = opts.end ?? 3;
  const throwAt = opts.throwAt ?? Infinity;
  const mk = (i: number): Snapshot => {
    const t = i * DT;
    return {
      t,
      players: {
        qb: { pos: { x: 0, y: -5 + t }, vel: { x: 0, y: 1 } },
        wr: { pos: { x: x0 + vx * t, y: 7 * t }, vel: { x: vx, y: 7 } },
        rb: { pos: { x: -3, y: -4 }, vel: { x: 0, y: 0 } },
        cb: { pos: { x: 8, y: 6 }, vel: { x: 0, y: 0 } },
      },
      ball:
        t >= throwAt
          ? { state: 'inAir', pos: { x: 1, y: 2 }, landing: { x: 4, y: 20 }, tLand: 2 }
          : { state: 'held', pos: { x: 0, y: -5 + t }, carrierId: 'qb' },
      qb: { id: 'qb', eyeTarget: t >= 0.5 ? 'wr' : undefined, throwStarted: t >= throwAt },
    };
  };
  const h = createHistory(mk(0));
  for (let i = 1; i <= Math.round(end / DT); i++) pushSnapshot(h, mk(i));
  return h;
}

const viewer: Viewer = { id: 'cb', reaction: REACTION };
const other = (p: ReturnType<typeof buildPerception>, id: string) => p.others.find((o) => o.id === id);

describe('buildPerception (§8.3, FR-ENG-03)', () => {
  it('shows every other player at t − reaction (exact interpolation), excluding the viewer', () => {
    const h = build({ vx: 2 });
    const t = 1.2 + DT / 2; // between two samples
    const p = buildPerception(h, roster, viewer, t, FACTOR);
    expect(p.t).toBeCloseTo(t - REACTION, 12);
    expect(p.others.map((o) => o.id)).toEqual(['qb', 'rb', 'wr']);
    const wr = other(p, 'wr');
    expect(wr?.pos.x).toBeCloseTo(10 + 2 * (t - REACTION), 9);
    expect(wr?.pos.y).toBeCloseTo(7 * (t - REACTION), 9);
    expect(wr?.vel).toEqual({ x: 2, y: 7 });
  });

  it('takes side, role and number from the roster', () => {
    const p = buildPerception(build(), roster, viewer, 1, FACTOR);
    expect(other(p, 'wr')).toMatchObject({
      side: 'offense',
      role: 'WR',
      number: { kind: 'number', side: 'strong', number: 1 },
    });
    expect(other(p, 'rb')?.number).toEqual({ kind: 'role', role: 'RB' });
    expect(other(p, 'qb')?.number).toBeUndefined();
  });

  it('does not change when later snapshots (> t) are appended (no lookahead)', () => {
    const t = 1.2;
    const full = build({ vx: 3, end: 3, throwAt: 1.5 });
    const upToT = createHistory(full.snapshots[0] as Snapshot);
    for (const s of full.snapshots) if (s.t > 0 && s.t <= t + 1e-9) pushSnapshot(upToT, s);
    const a = buildPerception(upToT, roster, viewer, t, FACTOR);
    const b = buildPerception(full, roster, viewer, t, FACTOR);
    expect(b).toEqual(a);
  });

  it('never reads a snapshot after t even when t falls between samples', () => {
    const t = 1.2 + DT / 2;
    const full = build({ vx: 3, end: 3 });
    const upTo = createHistory(full.snapshots[0] as Snapshot);
    for (const s of full.snapshots) if (s.t > 0 && s.t <= t) pushSnapshot(upTo, s);
    const noDelay: Viewer = { id: 'cb', reaction: 0 };
    expect(buildPerception(full, roster, noDelay, t, FACTOR)).toEqual(
      buildPerception(upTo, roster, noDelay, t, FACTOR),
    );
  });

  it('reveals throwStarted / ball flight only once the delayed time passes the change', () => {
    const h = build({ throwAt: 1.0 });
    const early = buildPerception(h, roster, viewer, 1.2, FACTOR);
    expect(early.qb.throwStarted).toBe(false);
    expect(early.ball.state).toBe('held');
    expect(early.ball.landing).toBeUndefined();
    const late = buildPerception(h, roster, viewer, 1.0 + REACTION + DT, FACTOR);
    expect(late.qb.throwStarted).toBe(true);
    expect(late.ball.state).toBe('inAir');
    expect(late.ball.landing).toEqual({ x: 4, y: 20 });
    expect(late.ball.tLand).toBe(2);
    const exact = buildPerception(h, roster, viewer, 1.36, FACTOR);
    expect(exact.qb.throwStarted).toBe(true);
  });

  it('reports the qb position and eye target as of t − reaction', () => {
    const h = build();
    const p = buildPerception(h, roster, viewer, 1.0, FACTOR);
    expect(p.qb.pos.y).toBeCloseTo(-5 + 1.0 - REACTION, 9);
    expect(p.qb.eyeTarget).toBe('wr');
    const before = buildPerception(h, roster, viewer, 0.8, FACTOR);
    expect(before.qb.eyeTarget).toBeUndefined();
  });

  it('falls back to the ball position when there is no QB', () => {
    const h = createHistory({
      t: 0,
      players: { cb: { pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 } } },
      ball: { state: 'held', pos: { x: 2, y: 3 } },
      qb: { id: null, throwStarted: false },
    });
    pushSnapshot(h, { ...(h.snapshots[0] as Snapshot), t: 1 });
    const p = buildPerception(h, { players: { cb: roster.players.cb! } }, viewer, 1, FACTOR);
    expect(p.qb.pos).toEqual({ x: 2, y: 3 });
    expect(p.others).toEqual([]);
  });

  it('clamps to the first snapshot early in the play', () => {
    const p = buildPerception(build(), roster, viewer, 0.1, FACTOR);
    expect(p.t).toBeCloseTo(0.1 - REACTION, 12);
    expect(other(p, 'wr')?.pos).toEqual({ x: 10, y: 0 });
  });
});

describe('effectiveDelay (§8.6 leverage reaction factor)', () => {
  const T = 1.5;
  const man = (leverage: 'inside' | 'outside' | 'head-up' | undefined): Viewer => ({
    id: 'cb',
    reaction: REACTION,
    focus: { id: 'wr', leverage },
  });

  it('inside leverage on a receiver at x = 10 moving toward the ball → reaction × factor', () => {
    const h = build({ vx: -5, x0: 20 });
    expect(effectiveDelay(h, man('inside'), 'wr', T, FACTOR)).toBeCloseTo(REACTION * FACTOR, 12);
  });

  it('inside leverage on a receiver moving away from the ball → full reaction', () => {
    const h = build({ vx: 5, x0: 10 });
    expect(effectiveDelay(h, man('inside'), 'wr', T, FACTOR)).toBe(REACTION);
  });

  it('outside leverage is mirrored', () => {
    const away = build({ vx: 5, x0: 10 });
    const toward = build({ vx: -5, x0: 20 });
    expect(effectiveDelay(away, man('outside'), 'wr', T, FACTOR)).toBeCloseTo(REACTION * FACTOR, 12);
    expect(effectiveDelay(toward, man('outside'), 'wr', T, FACTOR)).toBe(REACTION);
  });

  it('mirrors for a receiver on the negative-x side', () => {
    const h = build({ vx: 5, x0: -20 }); // moving toward the ball
    expect(effectiveDelay(h, man('inside'), 'wr', T, FACTOR)).toBeCloseTo(REACTION * FACTOR, 12);
    expect(effectiveDelay(h, man('outside'), 'wr', T, FACTOR)).toBe(REACTION);
  });

  it('head-up, undefined leverage and non-focus targets get the full reaction', () => {
    const h = build({ vx: -5, x0: 20 });
    expect(effectiveDelay(h, man('head-up'), 'wr', T, FACTOR)).toBe(REACTION);
    expect(effectiveDelay(h, man(undefined), 'wr', T, FACTOR)).toBe(REACTION);
    expect(effectiveDelay(h, man('inside'), 'rb', T, FACTOR)).toBe(REACTION);
    expect(effectiveDelay(h, viewer, 'wr', T, FACTOR)).toBe(REACTION);
  });

  it('needs at least LEVERAGE_BREAK_SPEED of lateral speed', () => {
    const slow = build({ vx: -(LEVERAGE_BREAK_SPEED - 0.1), x0: 20 });
    expect(effectiveDelay(slow, man('inside'), 'wr', T, FACTOR)).toBe(REACTION);
    const edge = build({ vx: -LEVERAGE_BREAK_SPEED, x0: 20 });
    expect(effectiveDelay(edge, man('inside'), 'wr', T, FACTOR)).toBeCloseTo(REACTION * FACTOR, 12);
  });

  it('gives no reduction for a target on the ball line (|x| < 0.25)', () => {
    const h = build({ vx: 0, x0: 0.1 });
    expect(effectiveDelay(h, man('inside'), 'wr', T, FACTOR)).toBe(REACTION);
  });

  it('multiplies by delayFactor and never goes negative', () => {
    const h = build({ vx: -5, x0: 20 });
    const v: Viewer = { ...man('inside'), delayFactor: (id) => (id === 'wr' ? 2 : 1) };
    expect(effectiveDelay(h, v, 'wr', T, FACTOR)).toBeCloseTo(REACTION * FACTOR * 2, 12);
    expect(effectiveDelay(h, v, 'rb', T, FACTOR)).toBe(REACTION);
    expect(effectiveDelay(h, { ...viewer, delayFactor: () => -3 }, 'wr', T, FACTOR)).toBe(0);
  });

  it('feeds the reduced delay into buildPerception', () => {
    const h = build({ vx: -5, x0: 20 });
    const p = buildPerception(h, roster, man('inside'), T, FACTOR);
    const d = REACTION * FACTOR;
    expect(other(p, 'wr')?.pos.x).toBeCloseTo(20 - 5 * (T - d), 9);
    expect(other(p, 'rb')?.pos.x).toBe(-3);
    expect(p.t).toBeCloseTo(T - REACTION, 12);
  });
});

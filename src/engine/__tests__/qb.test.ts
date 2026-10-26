import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING } from '@/domain/defaults';
import { DEFAULT_BALL_SPOT, createDefaultFields } from '@/domain/field';
import { DEFAULT_PRESETS } from '@/domain/presets';
import { readTime } from '@/domain/stats';
import type { ID, Point, Role, SimEvent, Stats } from '@/domain/types';
import { createQbAgent, type QbPlan } from '../agents/qb';
import { leadTarget } from '../ball';
import { stepMovement } from '../movement';
import { createRng } from '../rng';
import type { AgentIntent, AgentState, FieldInfo, PerceivedPlayer, Perception, Rng } from '../types';

const DT = 1 / 60;
const INFO: FieldInfo = {
  field: createDefaultFields()['5v5'],
  ballSpot: DEFAULT_BALL_SPOT,
  minX: -26,
  maxX: 26,
  minY: -25,
  maxY: 50,
  tuning: DEFAULT_TUNING,
};
const stats = (over: Partial<Stats> = {}): Stats => ({
  ...DEFAULT_PRESETS.avg,
  iq: 0.5,
  release: 0.4,
  armRange: 25,
  eyeDiscipline: 0.5,
  ...over,
});

const defender = (id: ID, pos: Point, role: Role = 'C', vel: Point = { x: 0, y: 0 }): PerceivedPlayer => ({
  id,
  side: 'defense',
  role,
  pos,
  vel,
});
const offense = (id: ID, pos: Point): PerceivedPlayer => ({
  id,
  side: 'offense',
  role: 'WR',
  pos,
  vel: { x: 0, y: 0 },
});

function planFor(
  spots: Record<ID, Point | ((t: number) => Point)>,
  progression: ID[],
  over: Partial<QbPlan> = {},
): QbPlan {
  const posOf = (id: ID, t: number): Point | undefined => {
    const s = spots[id];
    return s === undefined ? undefined : typeof s === 'function' ? s(t) : s;
  };
  return {
    id: 'qb',
    start: { x: 0, y: -5 },
    drop: { type: 'qbDrop', depth: 2, style: 'under' },
    progression,
    receivers: Object.keys(spots).map((id) => ({ id, pos: posOf(id, 0) as Point })),
    strongSide: 'right',
    dropEnd: 0.8,
    plannedPos: posOf,
    ...over,
  };
}

interface Tick {
  t: number;
  pos: Point;
  out: AgentIntent;
}

function run(
  plan: QbPlan,
  others: (t: number, qb: Point) => PerceivedPlayer[],
  seconds: number,
  opts: { stats?: Stats; rng?: Rng } = {},
): Tick[] {
  const st = opts.stats ?? stats();
  const rng = opts.rng ?? (() => 0.99);
  const agent = createQbAgent({ plan, info: INFO });
  let kin = { pos: { ...plan.start }, vel: { x: 0, y: 0 } };
  const ticks: Tick[] = [];
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    const t = i * DT;
    const self: AgentState = {
      ...kin,
      id: plan.id,
      side: 'offense',
      role: 'QB',
      label: 'QB',
      stats: st,
      t,
      hasBall: true,
      isBallTarget: false,
    };
    const p: Perception = {
      t,
      others: others(t, kin.pos),
      ball: { state: 'held', pos: kin.pos },
      qb: { pos: kin.pos, throwStarted: false },
    };
    const out = agent.step(self, p, DT, rng);
    ticks.push({ t, pos: kin.pos, out });
    kin = stepMovement(kin, out, { speed: st.speed, accel: st.accel, cutLoss: st.cutLoss }, DT);
  }
  return ticks;
}

const events = (ticks: Tick[], type: SimEvent['type']): { t: number; id?: ID }[] =>
  ticks.flatMap((k) =>
    (k.out.events ?? [])
      .filter((e) => e.type === type)
      .map((e) => ({ t: k.t, ...(e.targetId !== undefined ? { id: e.targetId } : {}) })),
  );
const throws = (ticks: Tick[]): Tick[] => ticks.filter((k) => k.out.throw || k.out.throwaway);

const A = { x: -8, y: 10 };
const B = { x: 8, y: 10 };
/** Both receivers have a defender right next to them. */
const covered = (): PerceivedPlayer[] => [
  offense('a', A),
  offense('b', B),
  defender('da', { x: A.x + 0.2, y: A.y }),
  defender('db', { x: B.x + 0.2, y: B.y }),
];

describe('T-ENG QB drop', () => {
  it('backpedals to start.y - depth, stands, never crosses the LOS', () => {
    const ticks = run(planFor({ a: A }, ['a']), covered, 3);
    const last = ticks[ticks.length - 1] as Tick;
    expect(Math.abs(last.pos.y + 7)).toBeLessThan(0.1);
    expect(last.pos.x).toBeCloseTo(0, 5);
    expect(ticks.every((k) => k.pos.y <= 0)).toBe(true);
    expect(last.out.speed).toBe(0);
    const states = ticks.map((k) => k.out.state);
    expect(states[0]).toBe('drop');
    const firstBall = states.indexOf('ball');
    expect(firstBall).toBeGreaterThan(0);
    expect(states.slice(0, firstBall).every((s) => s === 'drop')).toBe(true);
    expect(states.slice(firstBall).every((s) => s === 'ball')).toBe(true);
  });

  it('with no drop the QB stays put and never moves past y = 0', () => {
    const plan = planFor({ a: A }, ['a'], { start: { x: 0, y: 0 }, drop: null });
    const ticks = run(plan, covered, 1);
    expect(ticks.every((k) => k.pos.y <= 1e-9)).toBe(true);
  });
});

describe('T-ENG QB reads', () => {
  const dropEndOf = (plan: QbPlan): number =>
    (run(plan, covered, 3).find((k) => k.out.state === 'ball') as Tick).t;

  it('reads in progression order, one auto window per readTime, eyeTarget follows', () => {
    const base = planFor({ a: A, b: B }, ['a', 'b']);
    const plan = { ...base, dropEnd: dropEndOf(base) };
    const ticks = run(plan, covered, 3, { stats: stats({ eyeDiscipline: 0 }) });
    const reads = events(ticks, 'read') as { t: number; id: ID }[];
    expect(reads.map((r) => r.id)).toEqual(['a', 'b']);
    expect(reads[0]!.t).toBeCloseTo(plan.dropEnd, 1);
    expect(reads[1]!.t - reads[0]!.t).toBeCloseTo(Math.max(readTime(0.5), 0.45), 1);
    const midFirst = ticks.find((k) => k.t >= reads[0]!.t + 0.1) as Tick;
    expect(midFirst.out.eyeTarget).toBe('a');
    const midSecond = ticks.find((k) => k.t >= reads[1]!.t + 0.1) as Tick;
    expect(midSecond.out.eyeTarget).toBe('b');
  });

  it('empty progression reads left to right', () => {
    const plan = planFor({ b: B, a: A }, []);
    const ticks = run(plan, covered, 2);
    expect(events(ticks, 'read')[0]?.id).toBe('a');
  });
});

describe('T-ENG QB throws', () => {
  it('throws to the first open read with aim = leadTarget', () => {
    const wr = (t: number): Point => ({ x: 6, y: 8 + 2 * t });
    const plan = planFor({ a: wr, b: B }, ['a', 'b']);
    const others = (t: number): PerceivedPlayer[] => [
      offense('a', wr(t)),
      offense('b', B),
      defender('d', { x: -10, y: 20 }),
    ];
    const th = throws(run(plan, others, 3));
    expect(th).toHaveLength(1);
    const k = th[0] as Tick;
    expect(k.out.throw?.targetId).toBe('a');
    const expected = leadTarget(k.pos, k.t + 0.4, wr, DEFAULT_TUNING).aim;
    expect(k.out.throw?.aim.x).toBeCloseTo(expected.x, 6);
    expect(k.out.throw?.aim.y).toBeCloseTo(expected.y, 6);
    expect(k.out.eyeTarget).toBe('a');
  });

  it('skips a covered read and throws to the next open one', () => {
    const plan = planFor({ a: A, b: B }, ['a', 'b']);
    const others = (): PerceivedPlayer[] => [
      offense('a', A),
      offense('b', B),
      defender('da', { x: A.x + 1, y: A.y }),
    ];
    const ticks = run(plan, others, 3, { stats: stats({ eyeDiscipline: 0 }) });
    const th = throws(ticks);
    expect(th).toHaveLength(1);
    expect((th[0] as Tick).out.throw?.targetId).toBe('b');
    const readB = events(ticks, 'read').find((e) => e.id === 'b') as { t: number };
    expect((th[0] as Tick).t).toBeGreaterThanOrEqual(readB.t);
  });

  it('predicts the defender position at arrival (pos + vel x dt)', () => {
    const plan = planFor({ a: A }, ['a']);
    const closing = (): PerceivedPlayer[] => [
      offense('a', A),
      defender('d', { x: A.x + 8, y: A.y }, 'C', { x: -5.3, y: 0 }),
    ];
    expect(throws(run(plan, closing, 1.5))).toHaveLength(0);
    const standing = (): PerceivedPlayer[] => [offense('a', A), defender('d', { x: A.x + 8, y: A.y })];
    expect(throws(run(plan, standing, 1.5))).toHaveLength(1);
  });

  it('never throws to a catch point at or behind the LOS', () => {
    const plan = planFor({ c: { x: 5, y: -1 } }, ['c']);
    expect(throws(run(plan, () => [offense('c', { x: 5, y: -1 })], 3))).toHaveLength(0);
  });

  it('never throws beyond armRange', () => {
    const far = { x: 0, y: 40 };
    const none = run(planFor({ f: far }, ['f']), () => [offense('f', far)], 3, {
      stats: stats({ armRange: 20 }),
    });
    expect(throws(none)).toHaveLength(0);
    const near = { x: 0, y: 12 };
    const ok = run(planFor({ f: near }, ['f']), () => [offense('f', near)], 2, {
      stats: stats({ armRange: 20 }),
    });
    expect(throws(ok)).toHaveLength(1);
  });

  it('decides once: no second throw intent and the QB stands still', () => {
    const plan = planFor({ a: B }, ['a']);
    const ticks = run(plan, () => [offense('a', B)], 3);
    const i = ticks.findIndex((k) => k.out.throw);
    expect(i).toBeGreaterThan(-1);
    expect(throws(ticks)).toHaveLength(1);
    for (const k of ticks.slice(i + 1)) {
      expect(k.out.speed).toBe(0);
      expect(k.out.eyeTarget).toBe('a');
    }
  });
});

describe('T-ENG QB pressure and clock', () => {
  it('rusher within 2 yd: one pressure event, immediate throw to the best open receiver', () => {
    const plan = planFor({ a: A, b: B }, ['a', 'b']);
    const others = (t: number, qb: Point): PerceivedPlayer[] => [
      offense('a', A),
      offense('b', B),
      defender('da', { x: A.x + 0.5, y: A.y }),
      ...(t >= 1 ? [defender('r', { x: qb.x + 1.5, y: qb.y }, 'R')] : []),
    ];
    // A covered while reading b is open; use disc 0 so the first read (a) is covered.
    const ticks = run(plan, others, 3, { stats: stats({ eyeDiscipline: 0 }) });
    const press = events(ticks, 'pressure');
    expect(press).toHaveLength(1);
    expect(press[0]!.t).toBeCloseTo(1, 1);
    const th = throws(ticks);
    expect(th).toHaveLength(1);
    expect((th[0] as Tick).t).toBeCloseTo(1, 1);
    expect((th[0] as Tick).out.throw?.targetId).toBe('b');
  });

  it('pressure with nobody open: throwaway', () => {
    const plan = planFor({ a: A, b: B }, ['a', 'b']);
    const others = (_t: number, qb: Point): PerceivedPlayer[] => [
      ...covered(),
      defender('r', { x: qb.x, y: qb.y + 1.5 }, 'R'),
    ];
    const ticks = run(plan, others, 2);
    const th = throws(ticks);
    expect(th).toHaveLength(1);
    expect((th[0] as Tick).out.throwaway).toBe(true);
    expect((th[0] as Tick).out.throw).toBeUndefined();
    expect(events(ticks, 'pressure')).toHaveLength(1);
  });

  it('a non-rusher near the QB does not trigger pressure', () => {
    const plan = planFor({ a: A }, ['a']);
    const others = (_t: number, qb: Point): PerceivedPlayer[] => [
      offense('a', A),
      defender('da', { x: A.x + 0.2, y: A.y }),
      defender('lb', { x: qb.x + 1, y: qb.y }, 'LB'),
    ];
    const ticks = run(plan, others, 2);
    expect(events(ticks, 'pressure')).toHaveLength(0);
    expect(throws(ticks)).toHaveLength(0);
  });

  it('pass clock: everyone covered, throwaway at t >= passClock - release', () => {
    const plan = planFor({ a: A, b: B }, ['a', 'b']);
    const th = throws(run(plan, covered, 8));
    expect(th).toHaveLength(1);
    const k = th[0] as Tick;
    expect(k.out.throwaway).toBe(true);
    expect(k.t).toBeGreaterThanOrEqual(7 - 0.4 - 1e-6);
    expect(k.t).toBeLessThan(7 - 0.4 + 2 * DT);
  });
});

describe('T-ENG QB look-off', () => {
  const base = planFor({ a: A, b: B }, ['a', 'b']);
  const plan = {
    ...base,
    dropEnd: (run(base, covered, 3).find((k) => k.out.state === 'ball') as Tick).t,
  };
  const eyes = (disc: number, rng: Rng): { rel: number; eye?: ID; step: ID }[] => {
    const ticks = run(plan, covered, 2, { stats: stats({ eyeDiscipline: disc }), rng });
    const reads = events(ticks, 'read') as { t: number; id: ID }[];
    const lastRead = reads[reads.length - 1] as { t: number };
    return ticks
      .filter((k) => k.out.state === 'ball' && k.t < lastRead.t + 0.4)
      .map((k) => {
        const cur = [...reads].reverse().find((r) => r.t <= k.t + 1e-9) as { t: number; id: ID };
        return { rel: k.t - cur.t, eye: k.out.eyeTarget, step: cur.id };
      });
  };

  it('eyeDiscipline 1: eyeTarget is the other receiver in the first half of each step', () => {
    const rows = eyes(1, () => 0.5);
    const half = Math.max(readTime(0.5), 0.45) / 2;
    const first = rows.filter((r) => r.rel < half - 1e-6);
    const second = rows.filter((r) => r.rel > half + 1e-6);
    expect(first.length).toBeGreaterThan(0);
    expect(first.every((r) => r.eye !== r.step)).toBe(true);
    expect(second.every((r) => r.eye === r.step)).toBe(true);
  });

  it('eyeDiscipline 0: never looks off', () => {
    expect(eyes(0, () => 0).every((r) => r.eye === r.step)).toBe(true);
  });

  it('is deterministic with a seeded rng', () => {
    expect(eyes(0.5, createRng(7))).toEqual(eyes(0.5, createRng(7)));
  });
});

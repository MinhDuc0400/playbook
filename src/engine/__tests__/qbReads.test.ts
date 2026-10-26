/** D-22 QB read model: windows, scores, read modes, check-down, forced throws, metrics. */
import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING } from '@/domain/defaults';
import { DEFAULT_BALL_SPOT, createDefaultFields } from '@/domain/field';
import { DEFAULT_PRESETS } from '@/domain/presets';
import type { ID, Point, ReadPlan, Role, Stats } from '@/domain/types';
import { simulateMany } from '../aggregate';
import { createQbAgent, type QbAgent, type QbPlan } from '../agents/qb';
import { stepMovement } from '../movement';
import { simulate } from '../simulate';
import type { AgentIntent, AgentState, FieldInfo, PerceivedPlayer, Perception } from '../types';
import { cover3Play, floodPlay, makeInput } from './fixtures';

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
const STATS: Stats = { ...DEFAULT_PRESETS.avg, iq: 0.5, release: 0.4, armRange: 25, eyeDiscipline: 0 };

const A: Point = { x: -8, y: 10 };
const B: Point = { x: 8, y: 10 };

const defender = (id: ID, pos: Point, role: Role = 'C'): PerceivedPlayer => ({
  id,
  side: 'defense',
  role,
  pos,
  vel: { x: 0, y: 0 },
});
const guard = (p: Point, id: string): PerceivedPlayer => defender(id, { x: p.x + 0.2, y: p.y });

function plan(over: Partial<QbPlan> = {}): QbPlan {
  const spots: Record<ID, Point> = { a: A, b: B };
  return {
    id: 'qb',
    start: { x: 0, y: -5 },
    drop: { type: 'qbDrop', depth: 2, style: 'under' },
    progression: ['a', 'b'],
    receivers: [
      { id: 'a', pos: A },
      { id: 'b', pos: B },
    ],
    strongSide: 'right',
    dropEnd: 0.8,
    plannedPos: (id) => spots[id],
    ...over,
  };
}

interface Tick {
  t: number;
  out: AgentIntent;
}

function run(
  p: QbPlan,
  others: (qb: Point) => PerceivedPlayer[],
  seconds = 4,
): { ticks: Tick[]; agent: QbAgent } {
  const agent = createQbAgent({ plan: p, info: INFO });
  let kin = { pos: { ...p.start }, vel: { x: 0, y: 0 } };
  const ticks: Tick[] = [];
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    const t = i * DT;
    const self: AgentState = {
      ...kin,
      id: p.id,
      side: 'offense',
      role: 'QB',
      label: 'QB',
      stats: STATS,
      t,
      hasBall: true,
      isBallTarget: false,
    };
    const per: Perception = {
      t,
      others: others(kin.pos),
      ball: { state: 'held', pos: kin.pos },
      qb: { pos: kin.pos, throwStarted: false },
    };
    const out = agent.step(self, per, DT, () => 0.99);
    ticks.push({ t, out });
    kin = stepMovement(kin, out, { speed: STATS.speed, accel: STATS.accel, cutLoss: STATS.cutLoss }, DT);
  }
  return { ticks, agent };
}

const firstThrow = (ticks: Tick[]): Tick | undefined => ticks.find((k) => k.out.throw || k.out.throwaway);
const readOrderOf = (ticks: Tick[]): ID[] =>
  ticks.flatMap((k) => (k.out.events ?? []).filter((e) => e.type === 'read').map((e) => e.targetId as ID));
const bothCovered = (): PerceivedPlayer[] => [guard(A, 'da'), guard(B, 'db')];
const aCovered = (): PerceivedPlayer[] => [guard(A, 'da')];

describe('D-22 read windows', () => {
  it('follow the QB rhythm, stretch for a late break and are sequential', () => {
    const p = plan({
      receivers: [
        { id: 'a', pos: A, breakTime: 0.5 },
        { id: 'b', pos: B, breakTime: 2.2 },
      ],
    });
    const { agent } = run(p, bothCovered, 0.2);
    const [wa, wb] = agent.windows;
    expect(wa?.id).toBe('a');
    expect(wa?.from).toBeCloseTo(0.8, 6);
    expect(wb?.id).toBe('b');
    expect(wb?.from).toBeCloseTo(wa!.to, 6);
    expect(wb!.to - wb!.from).toBeGreaterThan(wa!.to - wa!.from + 0.1); // late break stretches the window
  });

  it('does not throw a covered first read; throws the open second read inside its window', () => {
    const { ticks, agent } = run(plan(), aCovered);
    const th = firstThrow(ticks) as Tick;
    const wb = agent.windows[1] as { from: number; to: number };
    expect(th.out.throw?.targetId).toBe('b');
    expect(th.t).toBeGreaterThanOrEqual(wb.from - 1e-6);
    expect(th.t).toBeLessThan(wb.to);
    expect(agent.decision).toMatchObject({ kind: 'read', targetId: 'b', readIndex: 1 });
  });

  it('a manual window delays the read', () => {
    const p = plan({ readPlan: { mode: 'progression', windows: { a: { from: 2, to: 2.6 } } } });
    const { ticks, agent } = run(p, () => []);
    const th = firstThrow(ticks) as Tick;
    expect(th.out.throw?.targetId).toBe('a');
    expect(th.t).toBeGreaterThanOrEqual(2 - 1e-6);
    expect(agent.windows[0]).toMatchObject({ id: 'a', from: 2, to: 2.6, auto: false });
  });
});

describe('D-22 scores and minimum score', () => {
  it('honours the per-receiver minScore (read blocked, check-down takes it after the last window)', () => {
    const blocked: ReadPlan = { mode: 'progression', minScore: { a: 100, b: 100 } };
    const { ticks, agent } = run(plan({ readPlan: blocked }), () => []);
    const th = firstThrow(ticks) as Tick;
    const last = agent.windows[agent.windows.length - 1] as { to: number };
    expect(th.t).toBeGreaterThanOrEqual(last.to - 1e-6);
    expect(agent.decision?.kind).toBe('checkdown');
    expect(agent.decision?.readIndex).toBeNull();
  });

  it('with the default minimum an open first read is thrown at once', () => {
    const { agent } = run(plan(), () => []);
    expect(agent.decision).toMatchObject({ kind: 'read', targetId: 'a', readIndex: 0 });
    expect(agent.decision!.score).toBeGreaterThanOrEqual(DEFAULT_TUNING.scoreThrow);
  });

  it('exposes qbDebug scores for every receiver after the drop, with the current readId', () => {
    const { ticks } = run(plan(), bothCovered, 1.2);
    const withDebug = ticks.filter((k) => k.out.qbDebug);
    expect(withDebug.length).toBeGreaterThan(0);
    expect(withDebug.every((k) => k.t >= 0.5)).toBe(true);
    const last = withDebug[withDebug.length - 1] as Tick;
    expect(Object.keys(last.out.qbDebug!.scores).sort()).toEqual(['a', 'b']);
    expect(last.out.qbDebug!.readId).toBe('a');
    for (const s of Object.values(last.out.qbDebug!.scores)) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    }
  });
});

describe('D-22 read modes', () => {
  it("'leftToRight' changes the first read", () => {
    const prog = run(plan({ progression: ['b', 'a'] }), bothCovered, 1.2).ticks;
    expect(readOrderOf(prog)[0]).toBe('b');
    const ltr = run(plan({ progression: ['b', 'a'], readPlan: { mode: 'leftToRight' } }), bothCovered, 1.2);
    expect(readOrderOf(ltr.ticks)[0]).toBe('a');
  });

  it("'best' throws to the best-scoring receiver once reads open", () => {
    const deeper = { ...B, y: 14 };
    const p = plan({
      readPlan: { mode: 'best' },
      plannedPos: (id) => (id === 'a' ? A : deeper),
      receivers: [
        { id: 'a', pos: A },
        { id: 'b', pos: deeper },
      ],
    });
    const { agent } = run(p, () => []);
    expect(agent.decision?.kind).toBe('read');
    expect(agent.decision?.targetId).toBe('b');
  });
});

describe('D-22 check-down, forced and throwaway', () => {
  it('everything covered: no read or check-down, the pass clock throws away', () => {
    const { ticks, agent } = run(plan(), bothCovered, 8);
    expect(firstThrow(ticks)?.out.throwaway).toBe(true);
    expect(agent.decision?.kind).toBe('throwaway');
  });

  it('pressure with an open receiver: forced throw to it', () => {
    const { agent } = run(plan(), (qb) => [guard(A, 'da'), defender('r', { x: qb.x + 1, y: qb.y }, 'R')]);
    expect(agent.decision).toMatchObject({ kind: 'forced', targetId: 'b', readIndex: null });
  });

  it('pressure with nobody open: throwaway', () => {
    const { agent } = run(plan(), (qb) => [...bothCovered(), defender('r', { x: qb.x + 1, y: qb.y }, 'R')]);
    expect(agent.decision?.kind).toBe('throwaway');
  });
});

describe('D-22 simulate and aggregate', () => {
  const sim = (seed = 3) => simulate(makeInput(floodPlay(), cover3Play(), { seed, noise: true }));

  it('frames carry qb scores after the drop and metrics.reads matches the throw', () => {
    const r = sim();
    const scored = r.frames.filter((f) => f.qb);
    expect(scored.length).toBeGreaterThan(0);
    const reads = r.metrics.reads!;
    expect(reads.mode).toBe('progression');
    expect(reads.windows.length).toBe(4);
    const thrown = r.events.find((e) => e.type === 'throw');
    if (thrown?.targetId !== undefined) {
      expect(reads.decision.targetId).toBe(thrown.targetId);
      const start = r.events.find((e) => e.type === 'throwStart') as { t: number };
      expect(reads.decision.t).toBeCloseTo(start.t, 6);
      const w = reads.windows.find((x) => x.id === thrown.targetId);
      if (reads.decision.kind === 'read') {
        expect(reads.windows[reads.decision.readIndex as number]?.id).toBe(thrown.targetId);
        expect(w).toBeDefined();
      }
    }
  });

  it('windows start after the planned break of a route (flood: Y out breaks after the snap)', () => {
    const w = sim().metrics.reads!.windows;
    expect(w.every((x) => x.to > x.from)).toBe(true);
    for (let i = 1; i < w.length; i++) expect(w[i]!.from).toBeGreaterThanOrEqual(w[i - 1]!.to - 1e-9);
  });

  it("decision kind 'none' when the QB never decides", () => {
    // The play times out while the QB is still dropping back.
    const input = makeInput(floodPlay(), cover3Play());
    input.tuning.maxTime = 0.3;
    const r = simulate(input);
    expect(r.outcome.kind).toBe('timeout');
    expect(r.metrics.reads!.decision).toMatchObject({ kind: 'none', readIndex: null });
  });

  it('readDistribution sums to 1 and keys are read numbers or decision kinds', () => {
    const agg = simulateMany(makeInput(floodPlay(), cover3Play(), { seed: 5, noise: true }), 30);
    const dist = agg.readDistribution!;
    expect(Object.values(dist).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    for (const k of Object.keys(dist)) {
      expect(k).toMatch(/^([1-9]|checkdown|forced|throwaway|none)$/);
    }
  });
});

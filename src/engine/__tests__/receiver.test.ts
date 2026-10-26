import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_TUNING } from '@/domain/defaults';
import { DEFAULT_PRESETS } from '@/domain/presets';
import { buildRoute } from '@/domain/routeTree';
import type { Point, Rng } from '@/domain/types';
import { clampToSidelines, stepMovement } from '../movement';
import { planRoute } from '../routeFollower';
import type { Agent, AgentIntent, AgentState, FieldInfo, Perception } from '../types';
import { createReceiverAgent } from '../agents/receiver';

const DT = 1 / 60;
const stats = DEFAULT_PRESETS.avg;
const info = {
  minX: -15,
  maxX: 15,
  minY: -25,
  maxY: 45,
  tuning: DEFAULT_TUNING,
} as unknown as FieldInfo;

const held: Perception = {
  t: 0,
  others: [],
  ball: { state: 'held', pos: { x: 0, y: -5 } },
  qb: { pos: { x: 0, y: -5 }, throwStarted: false },
};

interface Tick {
  t: number;
  pos: Point;
  speed: number;
  out: AgentIntent;
}

function run(
  agent: Agent,
  start: Point,
  seconds: number,
  perception: (t: number) => Perception = () => held,
  target: (t: number) => boolean = () => false,
  rng: Rng = { next: () => 0.5 } as unknown as Rng,
): Tick[] {
  let pos = { ...start };
  let vel = { x: 0, y: 0 };
  const limits = { speed: stats.speed, accel: stats.accel, cutLoss: stats.cutLoss };
  const ticks: Tick[] = [];
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    const t = i * DT;
    const self: AgentState = {
      id: 'wr',
      side: 'offense',
      role: 'WR',
      label: 'X',
      stats,
      t,
      pos,
      vel,
      hasBall: false,
      isBallTarget: target(t),
    };
    const out = agent.step(self, perception(t), DT, rng);
    const k = clampToSidelines(stepMovement({ pos, vel }, out, limits, DT), info.minX, info.maxX);
    pos = k.pos;
    vel = k.vel;
    ticks.push({ t, pos, speed: Math.hypot(vel.x, vel.y), out });
  }
  return ticks;
}

const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

describe('createReceiverAgent', () => {
  it('runs a slant through both waypoints with exactly one break event', () => {
    const start = { x: 8, y: 0 };
    const route = buildRoute('slant', start, { depth: 3 });
    const plan = planRoute('wr', start, route)!;
    const ticks = run(createReceiverAgent({ id: 'wr', plan, info }), start, 3);
    const breaks = ticks.filter((k) => k.out.events?.some((e) => e.type === 'break'));
    expect(breaks).toHaveLength(1);
    expect(ticks[10]?.out.state).toBe('route');
    for (const wp of route.path) {
      expect(Math.min(...ticks.map((k) => dist(k.pos, wp)))).toBeLessThan(0.6);
    }
  });

  it('slows during the tell window before an out break', () => {
    const start = { x: 8, y: 0 };
    const plan = planRoute('wr', start, buildRoute('out', start, { depth: 10 }))!;
    const ticks = run(createReceiverAgent({ id: 'wr', plan, info }), start, 3);
    const peak = Math.max(...ticks.map((k) => k.speed));
    const iBreak = ticks.findIndex((k) => k.out.events?.length);
    expect(iBreak).toBeGreaterThan(0);
    const before = ticks.slice(Math.max(0, iBreak - 12), iBreak);
    expect(Math.min(...before.map((k) => k.speed))).toBeLessThan(peak * 0.9);
    expect(peak).toBeGreaterThan(stats.speed * 0.9);
  });

  it('stop route ends standing near the last point', () => {
    const start = { x: 8, y: 0 };
    const route = buildRoute('hitch', start, { depth: 5 });
    const plan = planRoute('wr', start, route)!;
    const ticks = run(createReceiverAgent({ id: 'wr', plan, info }), start, 5);
    const last = ticks[ticks.length - 1]!;
    expect(last.speed).toBeLessThan(0.05);
    expect(dist(last.pos, route.path[route.path.length - 1]!)).toBeLessThan(0.6);
  });

  it('continue route runs to the sideline', () => {
    const start = { x: 8, y: 0 };
    const plan = planRoute('wr', start, buildRoute('out', start, { depth: 5 }))!;
    const ticks = run(createReceiverAgent({ id: 'wr', plan, info }), start, 6);
    expect(ticks[ticks.length - 1]!.pos.x).toBeCloseTo(info.maxX, 3);
  });

  it('target seeks the landing point and arrives', () => {
    const start = { x: 0, y: 5 };
    const landing = { x: 3, y: 5 };
    const plan = planRoute('wr', start, buildRoute('go', start))!;
    const air: Perception = { ...held, ball: { state: 'inAir', pos: landing, landing, tLand: 2 } };
    const ticks = run(
      createReceiverAgent({ id: 'wr', plan, info }),
      start,
      2,
      () => air,
      () => true,
    );
    expect(ticks[5]?.out.state).toBe('ball');
    expect(dist(ticks[ticks.length - 1]!.pos, landing)).toBeLessThan(0.3);
  });

  it('ignores the ball when not the target', () => {
    const start = { x: 0, y: 5 };
    const landing = { x: 10, y: 5 };
    const plan = planRoute('wr', start, buildRoute('go', start))!;
    const air: Perception = { ...held, ball: { state: 'inAir', pos: landing, landing, tLand: 2 } };
    const ticks = run(createReceiverAgent({ id: 'wr', plan, info }), start, 1, () => air);
    expect(ticks.every((k) => k.out.state === 'route')).toBe(true);
    expect(ticks[ticks.length - 1]!.pos.x).toBeCloseTo(0, 3);
  });

  it('stops when the ball is dead', () => {
    const start = { x: 0, y: 0 };
    const plan = planRoute('wr', start, buildRoute('go', start))!;
    const dead: Perception = { ...held, ball: { state: 'dead', pos: { x: 0, y: 3 } } };
    const ticks = run(createReceiverAgent({ id: 'wr', plan, info }), start, 3, (t) => (t < 1 ? held : dead));
    expect(ticks[ticks.length - 1]!.speed).toBeLessThan(0.01);
  });

  it('idles with no plan', () => {
    const ticks = run(createReceiverAgent({ id: 'wr', plan: null, info }), { x: 1, y: 1 }, 0.5);
    expect(ticks.every((k) => k.out.state === 'idle' && k.out.speed === 0)).toBe(true);
    expect(ticks[ticks.length - 1]!.pos).toEqual({ x: 1, y: 1 });
  });

  it('never calls rng', () => {
    const next = vi.fn(() => 0.5);
    const rng = { next } as unknown as Rng;
    const start = { x: 8, y: 0 };
    const plan = planRoute('wr', start, buildRoute('out', start))!;
    run(
      createReceiverAgent({ id: 'wr', plan, info }),
      start,
      1,
      () => held,
      () => false,
      rng,
    );
    expect(next).not.toHaveBeenCalled();
  });
});

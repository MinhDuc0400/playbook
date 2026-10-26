import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_TUNING } from '@/domain/defaults';
import { DEFAULT_PRESETS } from '@/domain/presets';
import type { Point, Rng } from '@/domain/types';
import { createRusherAgent } from '../agents/rusher';
import { stepMovement } from '../movement';
import type { Agent, AgentIntent, AgentState, FieldInfo, Perception } from '../types';

const DT = 1 / 60;
const stats = DEFAULT_PRESETS.avg;
const info = { minX: -15, maxX: 15, minY: -25, maxY: 45, tuning: DEFAULT_TUNING } as unknown as FieldInfo;

const perc = (qb: Point, ball: Perception['ball'] = { state: 'held', pos: qb }): Perception => ({
  t: 0,
  others: [],
  ball,
  qb: { pos: qb, throwStarted: false },
});

interface Tick {
  t: number;
  pos: Point;
  out: AgentIntent;
}

function run(agent: Agent, start: Point, seconds: number, p: (t: number) => Perception, rng?: Rng): Tick[] {
  let pos = { ...start };
  let vel = { x: 0, y: 0 };
  const limits = { speed: stats.speed, accel: stats.accel, cutLoss: stats.cutLoss };
  const ticks: Tick[] = [];
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    const t = i * DT;
    const self: AgentState = {
      id: 'r',
      side: 'defense',
      role: 'R',
      label: 'R1',
      stats,
      t,
      pos,
      vel,
      hasBall: false,
      isBallTarget: false,
    };
    const out = agent.step(self, p(t), DT, rng ?? ({ next: () => 0.5 } as unknown as Rng));
    const k = stepMovement({ pos, vel }, out, limits, DT);
    pos = k.pos;
    vel = k.vel;
    ticks.push({ t, pos, out });
  }
  return ticks;
}

const start = { x: 0, y: 7 };
const qb = { x: 0, y: -5 };

describe('createRusherAgent', () => {
  it('moves at t = 0 when delay is 0', () => {
    const a = createRusherAgent({ id: 'r', start, path: [], delay: 0, info });
    const ticks = run(a, start, 0.2, () => perc(qb));
    expect(ticks[0]!.out.speed).toBeGreaterThan(0);
    expect(ticks[0]!.out.state).toBe('rush');
    expect(ticks[ticks.length - 1]!.pos.y).toBeLessThan(start.y);
  });

  it('stands until the delay has passed', () => {
    const a = createRusherAgent({ id: 'r', start, path: [], delay: 1, info });
    const ticks = run(a, start, 1.5, () => perc(qb));
    const before = ticks.filter((k) => k.t < 1);
    expect(before.every((k) => k.out.speed === 0 && k.pos.y === start.y)).toBe(true);
    expect(ticks[ticks.length - 1]!.pos.y).toBeLessThan(start.y);
  });

  it('follows its path, then chases the perceived QB', () => {
    const path = [{ x: 6, y: 7 }];
    const a = createRusherAgent({ id: 'r', start, path, delay: 0, info });
    const ticks = run(a, start, 4, (t) => perc(t < 2 ? qb : { x: -10, y: -5 }));
    const atWp = ticks.find((k) => Math.hypot(k.pos.x - 6, k.pos.y - 7) <= 0.5)!;
    expect(atWp).toBeDefined();
    // Early on the heading goes toward the waypoint (+x).
    expect(ticks[5]!.out.heading.x).toBeGreaterThan(0);
    // After the waypoint, the heading points at the QB, and follows when the QB moves.
    const mid = ticks.find((k) => k.t > atWp.t + 0.1 && k.t < 2)!;
    expect(mid.out.heading.y).toBeLessThan(0);
    const late = ticks[ticks.length - 1]!;
    expect(late.out.heading.x).toBeLessThan(0);
    expect(late.out.state).toBe('rush');
  });

  it('goes to the landing point once the ball is in the air', () => {
    const landing = { x: 8, y: 7 };
    const air = perc(qb, { state: 'inAir', pos: landing, landing, tLand: 2 });
    const a = createRusherAgent({ id: 'r', start, path: [], delay: 0, info });
    const ticks = run(a, start, 3, () => air);
    expect(ticks[3]!.out.state).toBe('ball');
    expect(ticks[ticks.length - 1]!.pos.x).toBeGreaterThan(6);
  });

  it('stops when the ball is dead', () => {
    const a = createRusherAgent({ id: 'r', start, path: [], delay: 0, info });
    const dead = perc(qb, { state: 'dead', pos: qb });
    const ticks = run(a, start, 0.2, () => dead);
    expect(ticks.every((k) => k.out.speed === 0)).toBe(true);
  });

  it('never calls rng', () => {
    const next = vi.fn(() => 0.5);
    const a = createRusherAgent({ id: 'r', start, path: [{ x: 2, y: 5 }], delay: 0.1, info });
    run(a, start, 1, () => perc(qb), { next } as unknown as Rng);
    expect(next).not.toHaveBeenCalled();
  });
});

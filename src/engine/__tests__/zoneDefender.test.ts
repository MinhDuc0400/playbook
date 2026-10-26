import { describe, expect, it } from 'vitest';
import { DEFAULT_BALL_SPOT, createDefaultFields } from '@/domain/field';
import { DEFAULT_TUNING } from '@/domain/defaults';
import { DEFAULT_PRESETS } from '@/domain/presets';
import { distanceToPolygon } from '@/domain/geometry';
import type { Point, Role } from '@/domain/types';
import { zonePreset } from '@/domain/zones';
import { stepMovement } from '../movement';
import { createZoneDefender } from '../agents/zoneDefender';
import type { Agent, AgentIntent, AgentState, FieldInfo, PerceivedPlayer, Perception } from '../types';

const DT = 1 / 60;
const stats = DEFAULT_PRESETS.avg;
const field = createDefaultFields()['5v5'];
const info: FieldInfo = {
  field,
  ballSpot: DEFAULT_BALL_SPOT,
  minX: -15,
  maxX: 15,
  minY: -10,
  maxY: 60,
  tuning: { ...DEFAULT_TUNING },
};

interface Sim {
  pos: Point;
  vel: Point;
  intent?: AgentIntent;
}

const wr = (id: string, x: number, y: number, vx = 0, vy = 0, role: Role = 'WR'): PerceivedPlayer => ({
  id,
  side: 'offense',
  role,
  pos: { x, y },
  vel: { x: vx, y: vy },
});

function perc(others: PerceivedPlayer[], over: Partial<Perception> = {}): Perception {
  return {
    t: 0,
    others,
    ball: { state: 'held', pos: { x: 0, y: -5 } },
    qb: { pos: { x: 0, y: -5 }, throwStarted: false },
    ...over,
  };
}

function tick(agent: Agent, s: Sim, p: Perception, t: number): void {
  const self: AgentState = {
    id: 'z1',
    side: 'defense',
    role: 'LB',
    label: 'LB',
    pos: s.pos,
    vel: s.vel,
    stats,
    t,
    hasBall: false,
    isBallTarget: false,
  };
  const intent = agent.step(self, p, DT, () => 0.5);
  const k = stepMovement(
    { pos: s.pos, vel: s.vel },
    intent,
    { speed: stats.speed, accel: stats.accel, cutLoss: stats.cutLoss },
    DT,
  );
  s.pos = k.pos;
  s.vel = k.vel;
  s.intent = intent;
}

const deepShape = zonePreset('deep-middle', field);
const hookShape = zonePreset('hook-M', field);

function mk(shape: { polygon: Point[]; dropPoint: Point }, deep: boolean): Agent {
  return createZoneDefender({ id: 'z1', polygon: shape.polygon, dropPoint: shape.dropPoint, deep, info });
}

describe('zone defender', () => {
  it('phase 1 runs to the dropPoint first (state zone)', () => {
    const agent = mk(deepShape, true);
    const s: Sim = { pos: { x: 0, y: 5 }, vel: { x: 0, y: 0 } };
    for (let i = 0; i < 300; i++) tick(agent, s, perc([]), i * DT);
    expect(s.intent?.state).toBe('zone');
    expect(Math.hypot(s.pos.x - deepShape.dropPoint.x, s.pos.y - deepShape.dropPoint.y)).toBeLessThan(0.5);
  });

  it('deep zone picks the deeper of two receivers inside', () => {
    const agent = mk(deepShape, true);
    const s: Sim = { pos: { x: 0, y: 14 }, vel: { x: 0, y: 0 } };
    const others = [wr('a', -4, 12), wr('b', 4, 22)];
    for (let i = 0; i < 180; i++) tick(agent, s, perc(others), i * DT);
    expect(s.pos.x).toBeGreaterThan(1.5);
    expect(s.pos.y).toBeGreaterThan(18);
  });

  it('shallow zone picks the receiver closest to self', () => {
    const agent = mk(hookShape, false);
    const s: Sim = { pos: { x: -1, y: 6 }, vel: { x: 0, y: 0 } };
    const others = [wr('a', -2.5, 5), wr('b', 3.5, 9)];
    for (let i = 0; i < 120; i++) tick(agent, s, perc(others), i * DT);
    expect(s.pos.x).toBeLessThan(-0.5);
  });

  it('ignores the QB and defenders as threats', () => {
    const agent = mk(deepShape, true);
    const s: Sim = { pos: { x: 0, y: 14 }, vel: { x: 0, y: 0 } };
    const others = [wr('q', 0, 25, 0, 0, 'QB')];
    for (let i = 0; i < 60; i++) tick(agent, s, perc(others), i * DT);
    expect(s.pos.y).toBeLessThan(15);
  });

  it('stays within polygon + buffer when the receiver runs out the back', () => {
    const agent = mk(deepShape, true);
    const s: Sim = { pos: { x: 0, y: 14 }, vel: { x: 0, y: 0 } };
    const rec = { x: 0, y: 20 };
    let worst = 0;
    for (let i = 0; i < 360; i++) {
      rec.y += 8 * DT;
      tick(agent, s, perc([wr('a', rec.x, rec.y, 0, 8)]), i * DT);
      worst = Math.max(worst, distanceToPolygon(s.pos, deepShape.polygon));
    }
    expect(rec.y).toBeGreaterThan(40);
    expect(worst).toBeLessThanOrEqual(info.tuning.zoneBuffer + 0.3);
  });

  it('releases a receiver that leaves the zone: returns toward the dropPoint', () => {
    const agent = mk(hookShape, false);
    const s: Sim = { pos: { x: 0, y: 6 }, vel: { x: 0, y: 0 } };
    for (let i = 0; i < 120; i++) tick(agent, s, perc([wr('a', 3, 9)]), i * DT);
    const out = [wr('a', 12, 9)];
    for (let i = 0; i < 300; i++) tick(agent, s, perc(out), i * DT);
    expect(Math.hypot(s.pos.x - hookShape.dropPoint.x, s.pos.y - hookShape.dropPoint.y)).toBeLessThan(0.6);
  });

  it('drifts toward the QB eyeTarget (x moves toward it vs. no eyeTarget)', () => {
    const run = (eye: boolean): number => {
      const agent = mk(deepShape, true);
      const s: Sim = { pos: { x: 0, y: 14 }, vel: { x: 0, y: 0 } };
      const others = [wr('a', 0, 14), wr('e', 12, 14)];
      const p = perc(others, {
        qb: { pos: { x: 0, y: -5 }, throwStarted: false, ...(eye ? { eyeTarget: 'e' } : {}) },
      });
      for (let i = 0; i < 180; i++) tick(agent, s, p, i * DT);
      return s.pos.x;
    };
    expect(run(true)).toBeGreaterThan(run(false) + 0.3);
  });

  it('ball: throwStarted heads to eyeTarget; inAir heads to landing; dead stops', () => {
    const agent = mk(deepShape, true);
    const s: Sim = { pos: { x: 0, y: 14 }, vel: { x: 0, y: 0 } };
    tick(
      agent,
      s,
      perc([wr('e', 10, 14)], { qb: { pos: { x: 0, y: -5 }, throwStarted: true, eyeTarget: 'e' } }),
      0,
    );
    expect(s.intent?.state).toBe('ball');
    expect(s.intent?.heading.x).toBeCloseTo(1);
    tick(
      agent,
      s,
      perc([], { ball: { state: 'inAir', pos: { x: 0, y: 0 }, landing: { x: -10, y: 14 }, tLand: 1 } }),
      DT,
    );
    expect(s.intent?.heading.x).toBeLessThan(-0.9);
    tick(agent, s, perc([], { ball: { state: 'dead', pos: { x: 0, y: 0 } } }), 2 * DT);
    expect(s.intent?.speed).toBe(0);
  });
});

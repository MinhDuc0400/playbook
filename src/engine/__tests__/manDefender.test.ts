import { describe, expect, it } from 'vitest';
import { DEFAULT_BALL_SPOT, createDefaultFields } from '@/domain/field';
import { DEFAULT_TUNING } from '@/domain/defaults';
import { DEFAULT_PRESETS } from '@/domain/presets';
import type { Leverage, Point } from '@/domain/types';
import { stepMovement } from '../movement';
import { TRAIL_BEHIND, createManDefender } from '../agents/manDefender';
import type { Agent, AgentIntent, AgentState, FieldInfo, Perception } from '../types';

const DT = 1 / 60;
const stats = DEFAULT_PRESETS.avg;
const info: FieldInfo = {
  field: createDefaultFields()['5v5'],
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

function perceive(rec: Point, recVel: Point, over: Partial<Perception> = {}): Perception {
  return {
    t: 0,
    others: [{ id: 'wr', side: 'offense', role: 'WR', pos: rec, vel: recVel }],
    ball: { state: 'held', pos: { x: 0, y: -5 } },
    qb: { pos: { x: 0, y: -5 }, throwStarted: false },
    ...over,
  };
}

function selfState(s: Sim, t: number): AgentState {
  return {
    id: 'd1',
    side: 'defense',
    role: 'CB',
    label: 'CB',
    pos: s.pos,
    vel: s.vel,
    stats,
    t,
    hasBall: false,
    isBallTarget: false,
  };
}

function tick(agent: Agent, s: Sim, p: Perception, t: number): void {
  const intent = agent.step(selfState(s, t), p, DT, () => 0.5);
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

function make(technique: 'trail' | 'cushion', leverage: Leverage | undefined, cushion = 5): Agent {
  return createManDefender({ id: 'd1', targetId: 'wr', technique, cushion, leverage, info });
}

describe('man defender trail', () => {
  it('follows a go route within ~2 yd and returns focus each tick', () => {
    const agent = make('trail', 'head-up');
    const s: Sim = { pos: { x: 6, y: 2 }, vel: { x: 0, y: 0 } };
    const rec = { x: 6, y: 0 };
    let maxGap = 0;
    for (let i = 0; i < 240; i++) {
      rec.y += 6 * DT;
      tick(agent, s, perceive({ ...rec }, { x: 0, y: 6 }), i * DT);
      expect(s.intent?.focus).toEqual({ id: 'wr', leverage: 'head-up' });
      expect(s.intent?.state).toBe('man');
      if (i > 120) maxGap = Math.max(maxGap, Math.hypot(s.pos.x - rec.x, s.pos.y - rec.y));
    }
    expect(maxGap).toBeLessThan(2);
  });

  it('inside defender ends inside the receiver x (toward the ball), outside ends outside', () => {
    const run = (lev: Leverage): number => {
      const agent = make('trail', lev);
      const s: Sim = { pos: { x: 6, y: 2 }, vel: { x: 0, y: 0 } };
      const rec = { x: 6, y: 0 };
      for (let i = 0; i < 240; i++) {
        rec.y += 6 * DT;
        tick(agent, s, perceive({ ...rec }, { x: 0, y: 6 }), i * DT);
      }
      return s.pos.x - rec.x;
    };
    expect(run('inside')).toBeLessThan(-0.5);
    expect(run('outside')).toBeGreaterThan(0.5);
  });

  it('aim sits TRAIL_BEHIND behind the seen receiver (head-up, stationary self far away)', () => {
    const agent = make('trail', 'head-up');
    const s: Sim = { pos: { x: 0, y: 30 }, vel: { x: 0, y: 0 } };
    tick(agent, s, perceive({ x: 0, y: 10 }, { x: 0, y: 5 }), 0);
    // aim = (0, 10 + 5*0.3 - TRAIL_BEHIND); self is above -> heading straight down
    expect(s.intent?.heading.x).toBeCloseTo(0);
    expect(s.intent?.heading.y).toBeCloseTo(-1);
    expect(TRAIL_BEHIND).toBe(0.5);
  });

  it('holds position when the target is not perceived', () => {
    const agent = make('trail', undefined);
    const s: Sim = { pos: { x: 0, y: 5 }, vel: { x: 0, y: 0 } };
    tick(agent, s, { ...perceive({ x: 0, y: 0 }, { x: 0, y: 0 }), others: [] }, 0);
    expect(s.intent?.speed).toBe(0);
    expect(s.intent?.focus?.id).toBe('wr');
  });
});

describe('man defender cushion', () => {
  it('keeps depth while the receiver is far, then turns and runs', () => {
    const agent = make('cushion', 'head-up', 7);
    const s: Sim = { pos: { x: 6, y: 10 }, vel: { x: 0, y: 0 } };
    const rec = { x: 6, y: 0 };
    let yWhileFar: number | undefined;
    let ranDownfield = false;
    for (let i = 0; i < 300; i++) {
      rec.y += 5 * DT;
      const far = rec.y + 7 < s.pos.y;
      tick(agent, s, perceive({ ...rec }, { x: 0, y: 5 }), i * DT);
      if (far && i < 20) yWhileFar = s.pos.y;
      if (!far && s.vel.y > 3) ranDownfield = true;
    }
    expect(yWhileFar).toBeDefined();
    expect(Math.abs((yWhileFar ?? 0) - 10)).toBeLessThan(0.5);
    expect(ranDownfield).toBe(true);
    expect(Math.hypot(s.pos.x - rec.x, s.pos.y - rec.y)).toBeLessThan(3);
  });

  it('backpedal speed is capped at 0.8 x speed while holding', () => {
    const agent = make('cushion', 'head-up', 5);
    const s: Sim = { pos: { x: 0, y: 20 }, vel: { x: 0, y: 0 } };
    tick(agent, s, perceive({ x: 10, y: 0 }, { x: 0, y: 0 }), 0);
    expect(s.intent?.speed).toBeLessThanOrEqual(stats.speed * 0.8 + 1e-9);
  });
});

describe('man defender ball handling', () => {
  it('throwStarted: heads to the eyeTarget perceived position', () => {
    const agent = make('trail', 'head-up');
    const s: Sim = { pos: { x: 0, y: 5 }, vel: { x: 0, y: 0 } };
    const p = perceive(
      { x: 10, y: 5 },
      { x: 0, y: 0 },
      {
        qb: { pos: { x: 0, y: -5 }, throwStarted: true, eyeTarget: 'wr' },
      },
    );
    tick(agent, s, p, 0);
    expect(s.intent?.state).toBe('ball');
    expect(s.intent?.heading.x).toBeCloseTo(1);
    expect(s.intent?.speed).toBe(stats.speed);
    expect(s.intent?.focus?.id).toBe('wr');
  });

  it('inAir with landing: heads to the landing point', () => {
    const agent = make('trail', 'head-up');
    const s: Sim = { pos: { x: 0, y: 5 }, vel: { x: 0, y: 0 } };
    const p = perceive(
      { x: 10, y: 5 },
      { x: 0, y: 0 },
      {
        ball: { state: 'inAir', pos: { x: 0, y: 0 }, landing: { x: -8, y: 5 }, tLand: 1 },
      },
    );
    tick(agent, s, p, 0);
    expect(s.intent?.state).toBe('ball');
    expect(s.intent?.heading.x).toBeCloseTo(-1);
  });

  it('dead ball: stops', () => {
    const agent = make('trail', 'head-up');
    const s: Sim = { pos: { x: 0, y: 5 }, vel: { x: 0, y: 0 } };
    tick(
      agent,
      s,
      perceive({ x: 10, y: 5 }, { x: 0, y: 0 }, { ball: { state: 'dead', pos: { x: 0, y: 5 } } }),
      0,
    );
    expect(s.intent?.speed).toBe(0);
  });
});

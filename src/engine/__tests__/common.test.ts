import { describe, expect, it } from 'vitest';
import type { PerceivedPlayer, Perception } from '../types';
import { findPerceived, leverageOffsetPoint, reactiveAim, seek } from '../agents/common';

const seen = (id: string, x: number, y: number, vx = 0, vy = 0): PerceivedPlayer => ({
  id,
  side: 'offense',
  role: 'WR',
  pos: { x, y },
  vel: { x: vx, y: vy },
});

describe('findPerceived', () => {
  const p: Perception = {
    t: 0,
    others: [seen('a', 1, 2), seen('b', 3, 4)],
    ball: { state: 'held', pos: { x: 0, y: 0 } },
    qb: { pos: { x: 0, y: -5 }, throwStarted: false },
  };
  it('finds by id and returns undefined when absent', () => {
    expect(findPerceived(p, 'b')?.pos).toEqual({ x: 3, y: 4 });
    expect(findPerceived(p, 'zz')).toBeUndefined();
  });
});

describe('reactiveAim (§8.7)', () => {
  it('projects position along velocity by lookahead', () => {
    const a = reactiveAim(seen('a', 2, 5, 1, 7), 0.3);
    expect(a.x).toBeCloseTo(2.3);
    expect(a.y).toBeCloseTo(7.1);
  });
});

describe('leverageOffsetPoint', () => {
  const aim = { x: 5, y: 10 };
  it('inside moves toward the ball for targets on either side', () => {
    expect(leverageOffsetPoint(aim, 5, 'inside', 1).x).toBe(4);
    expect(leverageOffsetPoint({ x: -5, y: 10 }, -5, 'inside', 1).x).toBe(-4);
  });
  it('outside moves away from the ball for targets on either side', () => {
    expect(leverageOffsetPoint(aim, 5, 'outside', 1).x).toBe(6);
    expect(leverageOffsetPoint({ x: -5, y: 10 }, -5, 'outside', 1).x).toBe(-6);
  });
  it('head-up, undefined or centered target: no offset; y unchanged', () => {
    expect(leverageOffsetPoint(aim, 5, 'head-up', 1)).toEqual(aim);
    expect(leverageOffsetPoint(aim, 5, undefined, 1)).toEqual(aim);
    expect(leverageOffsetPoint(aim, 0, 'inside', 1)).toEqual(aim);
  });
});

describe('seek', () => {
  it('full speed outside the arrive radius, heading normalized', () => {
    const r = seek({ x: 0, y: 0 }, { x: 0, y: 10 }, 7, 2);
    expect(r.speed).toBe(7);
    expect(r.heading).toEqual({ x: 0, y: 1 });
  });
  it('slows proportionally inside the arrive radius', () => {
    expect(seek({ x: 0, y: 0 }, { x: 0, y: 1 }, 8, 2).speed).toBeCloseTo(4);
  });
  it('zero speed at the target; full speed with no arrive radius', () => {
    expect(seek({ x: 1, y: 1 }, { x: 1, y: 1 }, 8, 2).speed).toBe(0);
    expect(seek({ x: 0, y: 0 }, { x: 0, y: 0.1 }, 8).speed).toBe(8);
  });
});

import { describe, expect, it } from 'vitest';
import type { Frame } from '@/domain/types';
import { SNAP_FLIGHT, displayBallPos } from '../frames';

const qb = { x: 0, y: -5 };
const held = { t: 0, players: {}, ball: { state: 'held', pos: qb } } as unknown as Frame;
const air = { t: 1, players: {}, ball: { state: 'inAir', pos: { x: 3, y: 4 } } } as unknown as Frame;

describe('displayBallPos (D-37)', () => {
  it('sits on the LOS before the snap', () => {
    expect(displayBallPos(held, -1, qb)).toEqual({ x: 0, y: 0 });
    expect(displayBallPos(held, 0, qb)).toEqual({ x: 0, y: 0 });
  });

  it('flies from the LOS to the QB during the snap, then stays with the QB', () => {
    const mid = displayBallPos(held, SNAP_FLIGHT / 2, qb);
    expect(mid.x).toBeCloseTo(0);
    expect(mid.y).toBeCloseTo(-2.5);
    expect(displayBallPos(held, SNAP_FLIGHT, qb)).toEqual(qb);
    expect(displayBallPos(held, 2, { x: 1, y: -4 })).toEqual({ x: 1, y: -4 });
  });

  it('uses the frame ball when there is no QB, and the engine position once thrown', () => {
    expect(displayBallPos(held, 1, undefined)).toEqual(qb);
    expect(displayBallPos(air, 0, qb)).toEqual({ x: 3, y: 4 });
  });
});

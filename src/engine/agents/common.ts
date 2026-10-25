/** Helpers shared by defender agents (phase 3). Pure. */
import { notImplemented } from '@/domain/notImplemented';
import type { ID, Leverage, Point } from '@/domain/types';
import type { PerceivedPlayer, Perception } from '../types';

export function findPerceived(p: Perception, id: ID): PerceivedPlayer | undefined {
  return notImplemented(`findPerceived ${p.t}${id}`);
}

/** §8.7 reactiveAim = seen.pos + seen.vel × lookahead. */
export function reactiveAim(seen: PerceivedPlayer, lookahead: number): Point {
  return notImplemented(`reactiveAim ${seen.id}${lookahead}`);
}

/**
 * §8.6 man: aim point offset `offset` yd toward the leverage side: inside → toward the ball
 * (−sign(target.x)), outside → +sign(target.x), head-up/none → 0.
 */
export function leverageOffsetPoint(
  aim: Point,
  targetX: number,
  leverage: Leverage | undefined,
  offset: number,
): Point {
  return notImplemented(`leverageOffsetPoint ${aim.x}${targetX}${String(leverage)}${offset}`);
}

/** Heading + speed to reach `to` from `from`, slowing inside `arrive` yd (speed ∝ distance). */
export function seek(
  from: Point,
  to: Point,
  maxSpeed: number,
  arrive?: number,
): { heading: Point; speed: number } {
  return notImplemented(`seek ${from.x}${to.x}${maxSpeed}${String(arrive)}`);
}

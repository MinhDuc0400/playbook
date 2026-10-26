/** Helpers shared by defender agents (phase 3). Pure. */
import { EPS, distance } from '@/domain/geometry';
import type { ID, Leverage, Point } from '@/domain/types';
import type { Agent, AgentIntent, AgentState, PerceivedPlayer, Perception } from '../types';

export function findPerceived(p: Perception, id: ID): PerceivedPlayer | undefined {
  return p.others.find((o) => o.id === id);
}

/** §8.7 reactiveAim = seen.pos + seen.vel × lookahead. */
export function reactiveAim(seen: PerceivedPlayer, lookahead: number): Point {
  return { x: seen.pos.x + seen.vel.x * lookahead, y: seen.pos.y + seen.vel.y * lookahead };
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
  const sign = Math.sign(targetX);
  let dx = 0;
  if (leverage === 'inside') dx = -sign * offset;
  else if (leverage === 'outside') dx = sign * offset;
  return { x: aim.x + dx + 0, y: aim.y };
}

/** Heading + speed to reach `to` from `from`, slowing inside `arrive` yd (speed ∝ distance). */
export function seek(
  from: Point,
  to: Point,
  maxSpeed: number,
  arrive?: number,
): { heading: Point; speed: number } {
  const d = distance(from, to);
  if (d < EPS) return { heading: { x: 0, y: 0 }, speed: 0 };
  const heading = { x: (to.x - from.x) / d, y: (to.y - from.y) / d };
  const speed = arrive !== undefined && arrive > 0 ? maxSpeed * Math.min(1, d / arrive) : maxSpeed;
  return { heading, speed };
}

/**
 * Shared ball reaction for coverage defenders: ball in the air with a landing spot → run to it;
 * throw started → run to the (perceived) intended receiver; dead ball → stop. Undefined = no override.
 */
export function ballResponse(self: AgentState, p: Perception): AgentIntent | undefined {
  const speed = self.stats.speed;
  if (p.ball.state === 'inAir' && p.ball.landing) {
    return { ...seek(self.pos, p.ball.landing, speed), state: 'ball' };
  }
  if (p.qb.throwStarted && p.qb.eyeTarget !== undefined) {
    const tgt = findPerceived(p, p.qb.eyeTarget);
    if (tgt) return { ...seek(self.pos, tgt.pos, speed), state: 'ball' };
  }
  if (p.ball.state === 'dead') return { heading: { x: 0, y: 0 }, speed: 0, state: 'idle' };
  return undefined;
}

/** A coverage agent that also exposes debug info for the Matchup overlay (FR-MU-11). */
export interface DefenderAgent extends Agent {
  /** Aim point of the latest step, null when the agent had none (ball response, idle). */
  readonly lastAim: Point | null;
  /** Current man target, null for zone defenders. */
  readonly targetId: ID | null;
}

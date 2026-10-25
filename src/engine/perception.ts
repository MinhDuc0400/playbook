/** Delayed perception (SRS §8.3, §8.6 leverage factor, FR-ENG-03). Pure. */
import { notImplemented } from '@/domain/notImplemented';
import type { ID, Leverage, ReceiverRef, Role, Side } from '@/domain/types';
import type { Perception } from './types';
import type { History } from './world';

export interface Roster {
  /** Static info per player id. */
  players: Record<ID, { side: Side; role: Role; number?: ReceiverRef }>;
}

export interface Viewer {
  id: ID;
  reaction: number; // s
  /** Man defender focus (from its previous intent): enables the leverage reaction factor. */
  focus?: { id: ID; leverage: Leverage | undefined };
  /** Extra per-target delay multiplier (phase 5 deceleration tell). Default 1. */
  delayFactor?: (targetId: ID) => number;
}

/** Minimum lateral speed (yd/s) toward the leverage side that counts as "breaking toward leverage". */
export const LEVERAGE_BREAK_SPEED = 1;

/**
 * Effective delay for one target (§8.6): reaction × leverageReactionFactor when viewer.focus.id === target
 * and the target, sampled at t − reaction × leverageReactionFactor, moves laterally toward the defender's
 * leverage side with ≥ LEVERAGE_BREAK_SPEED: inside = toward the ball (−sign(target.x)), outside = away
 * from the ball (+sign(target.x)); head-up / none → no reduction. Otherwise reaction. Then × delayFactor.
 */
export function effectiveDelay(
  h: History,
  viewer: Viewer,
  targetId: ID,
  t: number,
  leverageReactionFactor: number,
): number {
  return notImplemented(
    `effectiveDelay ${h.snapshots.length}${viewer.id}${targetId}${t}${leverageReactionFactor}`,
  );
}

/**
 * Build the viewer's Perception at time t: every other player at t − effectiveDelay (interpolated via
 * playerAt), ball/qb from snapshotAt(t − reaction). `others` sorted by id. Never reads beyond t.
 */
export function buildPerception(
  h: History,
  roster: Roster,
  viewer: Viewer,
  t: number,
  leverageReactionFactor: number,
): Perception {
  return notImplemented(
    `buildPerception ${h.snapshots.length}${String(roster)}${viewer.id}${t}${leverageReactionFactor}`,
  );
}

/** Delayed perception (SRS §8.3, §8.6 leverage factor, FR-ENG-03). Pure. */
import type { ID, Leverage, ReceiverRef, Role, Side } from '@/domain/types';
import type { PerceivedPlayer, Perception } from './types';
import { playerAtCapped, snapshotBefore, type History } from './world';

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

/** Targets closer than this to the ball's x have no meaningful inside/outside. */
const LEVERAGE_MIN_OFFSET = 0.25;

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
  let delay = viewer.reaction;
  const focus = viewer.focus;
  if (focus && focus.id === targetId && (focus.leverage === 'inside' || focus.leverage === 'outside')) {
    const reduced = viewer.reaction * leverageReactionFactor;
    const sample = playerAtCapped(h, targetId, t - reduced, t);
    if (sample && Math.abs(sample.pos.x) >= LEVERAGE_MIN_OFFSET) {
      const side = sample.pos.x > 0 ? 1 : -1;
      const toward = (focus.leverage === 'outside' ? side : -side) * sample.vel.x;
      if (toward >= LEVERAGE_BREAK_SPEED) delay = reduced;
    }
  }
  const factor = viewer.delayFactor ? viewer.delayFactor(targetId) : 1;
  return Math.max(0, delay * factor);
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
  const tSee = t - viewer.reaction;
  const others: PerceivedPlayer[] = [];
  const ids = Object.keys(roster.players).sort();
  for (const id of ids) {
    if (id === viewer.id) continue;
    const info = roster.players[id];
    if (!info) continue;
    const delay = effectiveDelay(h, viewer, id, t, leverageReactionFactor);
    const s = playerAtCapped(h, id, t - delay, t);
    if (!s) continue;
    const p: PerceivedPlayer = {
      id,
      side: info.side,
      role: info.role,
      pos: { x: s.pos.x, y: s.pos.y },
      vel: { x: s.vel.x, y: s.vel.y },
    };
    if (info.number) p.number = info.number;
    others.push(p);
  }

  const snap = snapshotBefore(h, tSee);
  const ball: Perception['ball'] = {
    state: snap.ball.state,
    pos: { x: snap.ball.pos.x, y: snap.ball.pos.y },
  };
  if (snap.ball.landing) ball.landing = { x: snap.ball.landing.x, y: snap.ball.landing.y };
  if (snap.ball.tLand !== undefined) ball.tLand = snap.ball.tLand;

  const qbPlayer = snap.qb.id ? playerAtCapped(h, snap.qb.id, tSee, t) : undefined;
  const qbPos = qbPlayer ? qbPlayer.pos : snap.ball.pos;
  const qb: Perception['qb'] = {
    pos: { x: qbPos.x, y: qbPos.y },
    throwStarted: snap.qb.throwStarted,
  };
  if (snap.qb.eyeTarget !== undefined) qb.eyeTarget = snap.qb.eyeTarget;

  return { t: tSee, others, ball, qb };
}

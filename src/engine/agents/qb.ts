/** QB agent (SRS §8.5 QB, D-15). Knows its own team's plan; never the defense play. */
import { notImplemented } from '@/domain/notImplemented';
import type { ID, Point, QbDropAction } from '@/domain/types';
import type { Agent, FieldInfo } from '../types';

/** Assumed closing speed is not modelled: predicted defender position = seen pos + seen vel × Δt. */
export interface QbPlan {
  id: ID;
  start: Point;
  drop: QbDropAction | null;
  /** Read order (slot ids). Empty → all receivers sorted by id. */
  progression: ID[];
  /** Own receivers' planned positions (offense-only kinematic run, previewOffense). */
  plannedPos(receiverId: ID, t: number): Point | undefined;
}

/**
 * - Drop: backpedal to (start.x, start.y − depth) at 0.7 × speed (state 'drop'), then stand ('ball').
 *   QB never crosses the LOS (world also clamps).
 * - Reads start when the drop is done: each progression step lasts readTime(stats.iq) s (event 'read',
 *   targetId). eyeTarget = current read; per read step, with probability eyeDiscipline (one rng draw at
 *   the start of the step) look off: eyeTarget = another receiver (next one in progression, wrapping)
 *   for the first half of the step.
 * - Evaluate the current read every tick: tRelease = t + release; leadTarget(qbPos, tRelease, plannedPos)
 *   → aim, tArrive; valid if aim.y > 0 and |aim − qbPos| ≤ armRange; predicted separation = min over seen
 *   defenders of |aim − (def.pos + def.vel × (tArrive − p.t))|. Throw when valid and sep ≥
 *   throwOpenThreshold → intent.throw {targetId, aim}, event 'throwStart' is emitted by the world.
 * - Pressure: any seen defender with role 'R' within pressureRadius (event 'pressure' once), or
 *   t ≥ passClock − release → evaluate ALL receivers; best valid sep ≥ throwOpenThreshold → throw to it,
 *   else throwaway.
 * - After deciding: stand still.
 */
export function createQbAgent(opts: { plan: QbPlan; info: FieldInfo }): Agent {
  return notImplemented(`createQbAgent ${opts.plan.id}`);
}

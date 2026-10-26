/** Man defender (SRS §8.6 man, §8.7 reactive aim; anticipation added in phase 5). */
import { EPS } from '@/domain/geometry';
import type { ID, Leverage, Point } from '@/domain/types';
import type { AnticipationModel } from '../anticipation';
import type { AgentIntent, FieldInfo } from '../types';
import {
  ballResponse,
  type DefenderAgent,
  findPerceived,
  leverageOffsetPoint,
  reactiveAim,
  seek,
} from './common';

/** Trail technique: yards behind the receiver along its direction of travel. */
export const TRAIL_BEHIND = 0.5;

/** Backpedal speed while holding the cushion, as a fraction of max speed. */
const BACKPEDAL_FACTOR = 0.8;
/** Slow down inside this radius of the aim so a standing target does not cause jitter. */
const ARRIVE = 0.5;

/**
 * - Aim = leverageOffsetPoint(reactiveAim(seen target, lookahead), target.x, leverage, leverageOffset).
 * - 'trail' (§8.6 "bám sau-trong"): aim additionally TRAIL_BEHIND yd behind the target along its seen
 *   velocity direction; seek at full speed.
 * - 'cushion': while the seen target is > cushion yd away in y (target.y + cushion < self.y), keep depth:
 *   aim.y = max(self.y, target.y + cushion), backpedal speed ≤ 0.8 × speed; once the target is within the
 *   cushion → turn and run with it (aim as trail).
 * - Always return focus {id: targetId, leverage} (leverage reaction factor next tick).
 * - Ball: when p.qb.throwStarted → seek the eyeTarget's seen position; when ball inAir with landing →
 *   seek landing at full speed (state 'ball').
 * - State 'man'.
 */
export function createManDefender(opts: {
  id: ID;
  targetId: ID;
  technique: 'trail' | 'cushion';
  cushion: number;
  leverage: Leverage | undefined;
  info: FieldInfo;
  /** Optional §8.7 anticipation; absent = purely reactive (phase-3 behaviour). */
  anticipation?: AnticipationModel;
}): DefenderAgent {
  const { id, targetId, technique, cushion, leverage, info, anticipation: model } = opts;
  const focus = { id: targetId, leverage };
  const belief = model ? model.createBelief(targetId) : null;
  let lastAim: Point | null = null;
  return {
    id,
    get lastAim() {
      return lastAim;
    },
    targetId,
    step(self, p): AgentIntent {
      lastAim = null;
      const ball = ballResponse(self, p);
      if (ball) return { ...ball, focus };

      const target = findPerceived(p, targetId);
      if (!target) return { heading: { x: 0, y: 0 }, speed: 0, state: 'man', focus };

      if (belief) belief.observe(target.pos, p.t);
      const base = model
        ? model.aim(target, belief, self.t, self.stats.iq, info.tuning)
        : reactiveAim(target, info.tuning.lookahead);
      const aim = leverageOffsetPoint(base, target.pos.x, leverage, info.tuning.leverageOffset);
      const maxSpeed = self.stats.speed;
      lastAim = aim;

      if (technique === 'cushion' && target.pos.y + cushion < self.pos.y) {
        aim.y = Math.max(self.pos.y, target.pos.y + cushion);
        return { ...seek(self.pos, aim, maxSpeed * BACKPEDAL_FACTOR, ARRIVE), state: 'man', focus };
      }

      const v = Math.hypot(target.vel.x, target.vel.y);
      if (v > EPS) {
        aim.x -= (target.vel.x / v) * TRAIL_BEHIND;
        aim.y -= (target.vel.y / v) * TRAIL_BEHIND;
      }
      return { ...seek(self.pos, aim, maxSpeed, ARRIVE), state: 'man', focus };
    },
  };
}

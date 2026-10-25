/** Man defender (SRS §8.6 man, §8.7 reactive aim; anticipation added in phase 5). */
import { notImplemented } from '@/domain/notImplemented';
import type { ID, Leverage } from '@/domain/types';
import type { Agent, FieldInfo } from '../types';

/** Trail technique: yards behind the receiver along its direction of travel. */
export const TRAIL_BEHIND = 0.5;

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
}): Agent {
  return notImplemented(`createManDefender ${opts.id}`);
}

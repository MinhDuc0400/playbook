/** Catch resolution (SRS §8.8, D-11). Pure. */
import { notImplemented } from '@/domain/notImplemented';
import type { TuningParams } from '@/domain/types';
import type { Rng } from './types';

export type ContestResult = 'complete' | 'intercepted' | 'deflected' | 'incomplete';

/**
 * §8.8 verbatim algorithm:
 *   recOk = rng() < hands; defOk = rng() < ballSkills;
 *   neither → incomplete; rec only → complete;
 *   both → recShare = sum === 0 ? 0.5 : defDist^k / (recDist^k + defDist^k) (k = contestShareExponent),
 *          rng() < recShare → complete;
 *   defender wins → rng() < intShare ? intercepted : deflected.
 * Draw order is exactly: recOk, defOk, [recShare draw only when both], [intShare draw].
 */
export function resolveContest(
  hands: number,
  ballSkills: number,
  recDist: number,
  defDist: number,
  t: TuningParams,
  rng: Rng,
): ContestResult {
  return notImplemented(`resolveContest ${hands}${ballSkills}${recDist}${defDist}${String(t)}${String(rng)}`);
}

export interface ArrivalInput {
  /** Nearest offensive receiver to the landing point within catchRadius, if any. */
  receiver: { id: string; dist: number; hands: number } | null;
  /** Nearest defender within contestRadius, if any. */
  defender: { id: string; dist: number; ballSkills: number } | null;
}

/**
 * §8.8 table via resolveContest (D-11): receiver only → resolveContest(hands, 0, …);
 * defender only → resolveContest(0, ballSkills, …); both → full contest; neither → 'incomplete'
 * WITHOUT consuming rng.
 */
export function resolveArrival(a: ArrivalInput, t: TuningParams, rng: Rng): ContestResult {
  return notImplemented(`resolveArrival ${String(a)}${String(t)}${String(rng)}`);
}

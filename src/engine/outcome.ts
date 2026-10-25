/** Catch resolution (SRS §8.8, D-11). Pure. */
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
  const recOk = rng() < hands;
  const defOk = rng() < ballSkills;
  if (!recOk && !defOk) return 'incomplete';
  if (recOk && !defOk) return 'complete';
  if (recOk && defOk) {
    const k = t.contestShareExponent;
    const sum = recDist ** k + defDist ** k;
    const recShare = sum === 0 ? 0.5 : defDist ** k / sum;
    if (rng() < recShare) return 'complete';
  }
  return rng() < t.intShare ? 'intercepted' : 'deflected';
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
  const { receiver, defender } = a;
  if (!receiver && !defender) return 'incomplete';
  return resolveContest(
    receiver ? receiver.hands : 0,
    defender ? defender.ballSkills : 0,
    receiver ? receiver.dist : 0,
    defender ? defender.dist : 0,
    t,
    rng,
  );
}

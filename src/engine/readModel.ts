/**
 * QB read model (D-22): read order, read windows, closing-speed openness and read score. Pure.
 * Only uses the QB's own play knowledge and its (delayed) perception of defenders.
 */
import { notImplemented } from '@/domain/notImplemented';
import type { ID, LateralSide, Point, ReadMode, ReadPlan, ReadWindow, TuningParams } from '@/domain/types';
import type { PerceivedPlayer } from './types';

export interface ReceiverInfo {
  id: ID;
  /** Alignment at the snap (after motion). */
  pos: Point;
  /** Planned time (s after snap) of the receiver's first sharp break; undefined = none (go, flat…). */
  breakTime?: number;
}

/**
 * Read order:
 * - 'progression' → `progression` filtered to known receivers (then any receiver not listed, by id);
 *   empty progression → all receivers sorted by x ascending (left → right).
 * - 'leftToRight' / 'rightToLeft' → by alignment x (ties by y desc = closer to LOS first, then id).
 * - 'strongToWeak' / 'weakToStrong' → strong side first: outside-in on the strong side (|x| desc), then
 *   outside-in on the weak side; receivers on the ball (|x| < 0.25) come after the strong side.
 * - 'best' → same as 'progression' (used only for eyes / window layout; decision picks the best score).
 */
export function readOrder(
  mode: ReadMode,
  progression: readonly ID[],
  receivers: readonly ReceiverInfo[],
  strongSide: LateralSide,
): ID[] {
  return notImplemented(`readOrder ${mode}${progression.length}${receivers.length}${strongSide}`);
}

/**
 * Windows in read order. Manual windows (plan.windows[id]) are used as given (clamped from ≥ dropEnd,
 * to > from). Auto window i: from = max(prevTo (or dropEnd for i = 0), (breakTime ?? dropEnd) −
 * readWindowLead), to = from + max(readWindowMin, readSec). Manual windows still advance `prevTo`.
 */
export function buildWindows(opts: {
  order: readonly ID[];
  receivers: readonly ReceiverInfo[];
  plan: ReadPlan | undefined;
  dropEnd: number;
  readSec: number; // readTime(iq)
  tuning: TuningParams;
}): ReadWindow[] {
  return notImplemented(`buildWindows ${opts.order.length}`);
}

/**
 * Closing-speed openness: for each perceived defender, position at release = pos + vel × (tRelease − pT);
 * reach = assumedDefenderSpeed × max(0, (tArrive − tRelease) − assumedDefenderReaction);
 * sep_d = max(0, |defAtRelease − catchPt| − reach). Returns min over defenders (Infinity when none).
 */
export function predictedSeparation(opts: {
  catchPt: Point;
  tRelease: number;
  tArrive: number;
  pT: number; // perception time
  defenders: readonly PerceivedPlayer[];
  tuning: TuningParams;
}): number {
  return notImplemented(`predictedSeparation ${opts.catchPt.x}`);
}

/**
 * INT risk 0..1: max over defenders (at release, as above) of max(0, 1 − d / laneRadius) where d = distance
 * from the defender to the segment from → catchPt, ignoring the last 1 yd before the catch point (that is
 * the contest, already in separation). laneRadius 0 → 0.
 */
export function laneRisk(
  from: Point,
  catchPt: Point,
  defendersAtRelease: readonly Point[],
  laneRadius: number,
): number {
  return notImplemented(`laneRisk ${from.x}${catchPt.x}${defendersAtRelease.length}${laneRadius}`);
}

/**
 * Read score 0..100 = 100 × clamp((wScoreSep·open + wScoreGain·gain − wScoreRisk·risk) / (wScoreSep + wScoreGain), 0, 1)
 * with open = clamp(sep / scoreSepFull, 0, 1), gain = clamp(catchPt.y / scoreGainFull, 0, 1).
 */
export function readScore(sep: number, catchY: number, risk: number, tuning: TuningParams): number {
  return notImplemented(`readScore ${sep}${catchY}${risk}${String(tuning)}`);
}

/** Min score to throw on a receiver: plan.minScore?.[id] ?? tuning.scoreThrow. */
export function minScoreFor(id: ID, plan: ReadPlan | undefined, tuning: TuningParams): number {
  return notImplemented(`minScoreFor ${id}${String(plan)}${String(tuning)}`);
}

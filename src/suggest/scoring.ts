/** Suggest scoring (SRS §10.3, FR-SG-01..03). Pure. */
import { notImplemented } from '@/domain/notImplemented';
import type { AggregateResult, ID, Play, TuningParams } from '@/domain/types';

export type SuggestDirection = 'offense-vs-coverage' | 'defense-vs-play';

/** Yards that normalise avgYards to 1 in simScore (norm(avgYards) = clamp(avgYards / YARDS_NORM, 0, 1)). */
export const YARDS_NORM = 15;
export const TOP_N = 5;

/** §10.3: offense simScore = 0.5·pComplete + 0.3·norm(avgYards) − 0.1·pSack − 0.1·pInt, clamped to [0,1]. */
export function offenseSimScore(agg: AggregateResult): number {
  return notImplemented(`offenseSimScore ${agg.runs}`);
}

/** Defense: 1 − offenseSimScore. */
export function defenseSimScore(agg: AggregateResult): number {
  return notImplemented(`defenseSimScore ${agg.runs}`);
}

/** score = wTag·tagMatch + wSim·simScore + wMis·mismatchScore (missing sim → 0 contribution). */
export function totalScore(tag: 0 | 1, sim: number | null, mismatch: number, t: TuningParams): number {
  return notImplemented(`totalScore ${tag}${String(sim)}${mismatch}${String(t)}`);
}

export type Reason =
  | { kind: 'tag'; tag: string } // e.g. "beats:cover-2"
  | { kind: 'sim'; pComplete: number; avgYards: number; pSack: number; pInt: number }
  /** FR-SG-03 "Slant mở trung bình 2.3 yd lúc ném, hoàn thành 74%": the best target of the offense play. */
  | { kind: 'target'; label: string; routeName: string | null; avgSepAtThrow: number; completion: number };

export interface Suggestion {
  play: Play; // the suggested play
  opponent: Play; // the given play
  tag: 0 | 1;
  sim: number | null;
  mismatch: number; // 0 (FR-SG-05 is P2)
  score: number;
  reasons: Reason[];
  aggregate: AggregateResult | null;
}

/**
 * Tag tier (FR-SG-01): candidates of the opposite side and SAME format as `given`, scored with tag only;
 * ties broken by name; top `limit` (default TOP_N).
 */
export function rankByTag(
  given: Play,
  candidates: readonly Play[],
  t: TuningParams,
  limit?: number,
): Suggestion[] {
  return notImplemented(`rankByTag ${given.id}${candidates.length}${String(t)}${String(limit)}`);
}

/**
 * Combine tag + sim (FR-SG-02/03): `aggregates[candidateId]` from simulateMany(N = suggestRuns).
 * Offense-vs-coverage uses offenseSimScore; defense-vs-play uses defenseSimScore. Reasons: tag (if
 * matched), sim summary, and for offense suggestions the best target (max completes, ties by sep) with its
 * label + route template name. `labels`: slot id → label for each candidate offense play.
 */
export function rankWithSim(opts: {
  direction: SuggestDirection;
  given: Play;
  candidates: readonly Play[];
  aggregates: Readonly<Record<ID, AggregateResult>>;
  tuning: TuningParams;
  limit?: number;
}): Suggestion[] {
  return notImplemented(`rankWithSim ${opts.given.id}`);
}

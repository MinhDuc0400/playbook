/** Suggest scoring (SRS §10.3, FR-SG-01..03). Pure. */
import type { AggregateResult, ID, Play, TuningParams } from '@/domain/types';
import { tagMatch } from './tags';

export type SuggestDirection = 'offense-vs-coverage' | 'defense-vs-play';

/** Yards that normalise avgYards to 1 in simScore (norm(avgYards) = clamp(avgYards / YARDS_NORM, 0, 1)). */
export const YARDS_NORM = 15;
export const TOP_N = 5;

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

/** §10.3: offense simScore = 0.5·pComplete + 0.3·norm(avgYards) − 0.1·pSack − 0.1·pInt, clamped to [0,1]. */
export function offenseSimScore(agg: AggregateResult): number {
  const norm = clamp01(agg.avgYards / YARDS_NORM);
  return clamp01(0.5 * agg.pComplete + 0.3 * norm - 0.1 * agg.pSack - 0.1 * agg.pInt);
}

/** Defense: 1 − offenseSimScore. */
export function defenseSimScore(agg: AggregateResult): number {
  return 1 - offenseSimScore(agg);
}

/** score = wTag·tagMatch + wSim·simScore + wMis·mismatchScore (missing sim → 0 contribution). */
export function totalScore(tag: 0 | 1, sim: number | null, mismatch: number, t: TuningParams): number {
  return t.wTag * tag + t.wSim * (sim ?? 0) + t.wMis * mismatch;
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

function eligible(given: Play, candidates: readonly Play[]): Play[] {
  return candidates.filter((c) => c.side !== given.side && c.format === given.format);
}

/** Offense play and defense play of a (given, candidate) pair. */
function pair(given: Play, cand: Play): { offense: Play; defense: Play } {
  return given.side === 'offense' ? { offense: given, defense: cand } : { offense: cand, defense: given };
}

function matchedTagReason(offense: Play, defense: Play): Reason | null {
  if (!tagMatch(offense, defense)) return null;
  const covs = new Set(
    defense.tags
      .filter((t) => t.startsWith('cov:') || t === 'blitz')
      .map((t) => (t === 'blitz' ? t : t.slice(4))),
  );
  const hit = offense.tags.find((t) => t.startsWith('beats:') && covs.has(t.slice(6)));
  return hit ? { kind: 'tag', tag: hit } : null;
}

function compare(a: Suggestion, b: Suggestion): number {
  return b.score - a.score || a.play.name.localeCompare(b.play.name);
}

/**
 * Tag tier (FR-SG-01): candidates of the opposite side and SAME format as `given`, scored with tag only;
 * ties broken by name; top `limit` (default TOP_N).
 */
export function rankByTag(
  given: Play,
  candidates: readonly Play[],
  t: TuningParams,
  limit: number = TOP_N,
): Suggestion[] {
  const out: Suggestion[] = eligible(given, candidates).map((play) => {
    const { offense, defense } = pair(given, play);
    const tag = tagMatch(offense, defense);
    const reason = matchedTagReason(offense, defense);
    return {
      play,
      opponent: given,
      tag,
      sim: null,
      mismatch: 0,
      score: totalScore(tag, null, 0, t),
      reasons: reason ? [reason] : [],
      aggregate: null,
    };
  });
  return out.sort(compare).slice(0, limit);
}

function bestTargetReason(offense: Play, agg: AggregateResult): Reason | null {
  let best: { id: ID; throws: number; completes: number; sep: number } | null = null;
  for (const [id, s] of Object.entries(agg.perTarget)) {
    if (s.throws <= 0) continue;
    if (
      !best ||
      s.completes > best.completes ||
      (s.completes === best.completes && s.avgSepAtThrow > best.sep)
    ) {
      best = { id, throws: s.throws, completes: s.completes, sep: s.avgSepAtThrow };
    }
  }
  if (!best) return null;
  const slot = offense.players.find((p) => p.id === best.id);
  if (!slot) return null;
  const route = slot.actions.find((a) => a.type === 'route');
  return {
    kind: 'target',
    label: slot.label,
    routeName: route && route.type === 'route' ? (route.templateId ?? null) : null,
    avgSepAtThrow: best.sep,
    completion: best.completes / best.throws,
  };
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
  const { direction, given, candidates, aggregates, tuning, limit = TOP_N } = opts;
  const out: Suggestion[] = eligible(given, candidates).map((play) => {
    const { offense, defense } = pair(given, play);
    const tag = tagMatch(offense, defense);
    const agg = aggregates[play.id] ?? null;
    const sim = agg
      ? direction === 'offense-vs-coverage'
        ? offenseSimScore(agg)
        : defenseSimScore(agg)
      : null;
    const reasons: Reason[] = [];
    const tagReason = matchedTagReason(offense, defense);
    if (tagReason) reasons.push(tagReason);
    if (agg) {
      reasons.push({
        kind: 'sim',
        pComplete: agg.pComplete,
        avgYards: agg.avgYards,
        pSack: agg.pSack,
        pInt: agg.pInt,
      });
      const target = bestTargetReason(offense, agg);
      if (target) reasons.push(target);
    }
    return {
      play,
      opponent: given,
      tag,
      sim,
      mismatch: 0,
      score: totalScore(tag, sim, 0, tuning),
      reasons,
      aggregate: agg,
    };
  });
  return out.sort(compare).slice(0, limit);
}

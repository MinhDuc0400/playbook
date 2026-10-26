/** Session cache for sim results (FR-SG-06): key = hash(play A, play B, lineups, tuning). Pure. */
import { notImplemented } from '@/domain/notImplemented';
import type { AggregateResult, ID, Play, TuningParams } from '@/domain/types';

/** Stable string hash (e.g. cyrb53) of a JSON serialisation with sorted keys. */
export function stableHash(value: unknown): string {
  return notImplemented(`stableHash ${String(value)}`);
}

/** Key uses both plays' content (not just ids: edited plays must miss), lineup ids and tuning. */
export function suggestKey(
  a: Play,
  b: Play,
  lineupIds: readonly (ID | undefined)[],
  tuning: TuningParams,
): string {
  return notImplemented(`suggestKey ${a.id}${b.id}${lineupIds.length}${String(tuning)}`);
}

export interface SuggestCache {
  get(key: string): AggregateResult | undefined;
  set(key: string, value: AggregateResult): void;
  size(): number;
  clear(): void;
}

/** In-memory LRU (max 500 entries). */
export function createSuggestCache(max?: number): SuggestCache {
  return notImplemented(`createSuggestCache ${String(max)}`);
}

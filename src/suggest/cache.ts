/** Session cache for sim results (FR-SG-06): key = hash(play A, play B, lineups, tuning). Pure. */
import type { AggregateResult, ID, Play, TuningParams } from '@/domain/types';

function canonical(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const parts = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`);
  return `{${parts.join(',')}}`;
}

/** Stable string hash (cyrb53) of a JSON serialisation with sorted keys. */
export function stableHash(value: unknown): string {
  const str = canonical(value);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const n = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return n.toString(36);
}

/** Key uses both plays' content (not just ids: edited plays must miss), lineup ids and tuning. */
export function suggestKey(
  a: Play,
  b: Play,
  lineupIds: readonly (ID | undefined)[],
  tuning: TuningParams,
): string {
  return stableHash({ a, b, lineupIds: [...lineupIds], tuning });
}

export interface SuggestCache {
  get(key: string): AggregateResult | undefined;
  set(key: string, value: AggregateResult): void;
  size(): number;
  clear(): void;
}

/** In-memory LRU (max 500 entries). */
export function createSuggestCache(max = 500): SuggestCache {
  const map = new Map<string, AggregateResult>();
  return {
    get(key) {
      const v = map.get(key);
      if (v === undefined) return undefined;
      map.delete(key);
      map.set(key, v);
      return v;
    },
    set(key, value) {
      map.delete(key);
      map.set(key, value);
      while (map.size > max) {
        const oldest = map.keys().next();
        if (oldest.done) break;
        map.delete(oldest.value);
      }
    },
    size: () => map.size,
    clear: () => map.clear(),
  };
}

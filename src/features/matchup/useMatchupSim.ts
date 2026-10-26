/** Runs simulate() for the current matchup (memoized; main thread, < 20 ms per NFR-PERF-02). */
import { notImplemented } from '@/domain/notImplemented';
import type { DbSnapshot, Matchup, Play, SimResult } from '@/domain/types';
import type { BuiltSim } from './buildSimInput';

export interface MatchupSim {
  built: BuiltSim | null;
  result: SimResult | null;
  error: string | null; // simulate threw (bad data) — shown, never crashes (NFR-REL-04)
}

/** Recomputes only when matchup/plays/snapshot change (by reference). null inputs → all null. */
export function useMatchupSim(
  matchup: Matchup | null,
  offense: Play | null,
  defense: Play | null,
  snapshot: DbSnapshot | undefined,
): MatchupSim {
  return notImplemented(
    `useMatchupSim ${String(matchup)}${String(offense)}${String(defense)}${String(snapshot)}`,
  );
}

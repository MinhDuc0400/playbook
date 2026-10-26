/** Runs simulate() for the current matchup (memoized; main thread, < 20 ms per NFR-PERF-02). */
import { useMemo } from 'react';
import type { DbSnapshot, Matchup, Play, SimResult } from '@/domain/types';
import { simulate } from '@/engine/simulate';
import { buildSimInput, type BuiltSim } from './buildSimInput';

export interface MatchupSim {
  built: BuiltSim | null;
  result: SimResult | null;
  error: string | null; // simulate threw (bad data) — shown, never crashes (NFR-REL-04)
}

const EMPTY: MatchupSim = { built: null, result: null, error: null };

/** Recomputes only when matchup/plays/snapshot/debug change (by reference). null inputs → all null. */
export function useMatchupSim(
  matchup: Matchup | null,
  offense: Play | null,
  defense: Play | null,
  snapshot: DbSnapshot | undefined,
  debug = false,
): MatchupSim {
  return useMemo(() => {
    if (!matchup || !offense || !defense || !snapshot) return EMPTY;
    let built: BuiltSim | null = null;
    try {
      built = buildSimInput(matchup, offense, defense, snapshot);
      return { built, result: simulate(built.input, debug ? { debug: true } : undefined), error: null };
    } catch (e) {
      return { built, result: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [matchup, offense, defense, snapshot, debug]);
}

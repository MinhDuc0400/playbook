/** Tuning benchmark (FR-TUN-03, D-16). Pure: plays/settings passed in. */
import { notImplemented } from '@/domain/notImplemented';
import type { Play, Settings } from '@/domain/types';

export interface BenchmarkRow {
  offenseId: string;
  defenseId: string;
  offenseName: string;
  defenseName: string;
  runs: number;
  pComplete: number;
  pSack: number;
  pInt: number;
  avgYards: number;
  /** True for the D-16 "good concept vs matching coverage" pairs (offense tag beats:cover-N ↔ defense tag cov:cover-N). */
  target: boolean;
}

/**
 * Every offense × every defense of the same format: `runs` simulations, all players avg preset
 * (settings.presets.avg), noise on, seeds 1..runs, anticipation 0.5, ballSpot DEFAULT_BALL_SPOT, auto
 * defense flip via applyMatchupFlips (offense not flipped).
 */
export function runBenchmark(plays: readonly Play[], settings: Settings, runs: number): BenchmarkRow[] {
  return notImplemented(`runBenchmark ${plays.length}${String(settings)}${runs}`);
}

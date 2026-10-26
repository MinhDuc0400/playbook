/** Tuning benchmark (FR-TUN-03, D-16). Pure: plays/settings passed in. */
import { DEFAULT_BALL_SPOT } from '@/domain/field';
import { applyMatchupFlips } from '@/domain/matchupFlip';
import type { ID, Play, Settings, SimInput, Stats } from '@/domain/types';
import { simulate } from './simulate';

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

function coverages(play: Play, prefix: string): string[] {
  return play.tags.filter((t) => t.startsWith(prefix)).map((t) => t.slice(prefix.length));
}

/** offense beats:cover-N matches defense cov:cover-N ('man' tags excluded so Mesh only pairs with Cover 1). */
export function isTargetPair(offense: Play, defense: Play): boolean {
  const beats = coverages(offense, 'beats:').filter((c) => c.startsWith('cover-'));
  const covs = coverages(defense, 'cov:');
  return beats.some((b) => covs.includes(b));
}

function avgStats(play: Play, avg: Stats): Record<ID, Stats> {
  return Object.fromEntries(play.players.map((p) => [p.id, { ...avg }]));
}

/**
 * Every offense × every defense of the same format: `runs` simulations, all players avg preset
 * (settings.presets.avg), noise on, seeds 1..runs, anticipation 0.5, ballSpot DEFAULT_BALL_SPOT, auto
 * defense flip via applyMatchupFlips (offense not flipped).
 */
export function runBenchmark(plays: readonly Play[], settings: Settings, runs: number): BenchmarkRow[] {
  const rows: BenchmarkRow[] = [];
  const offenses = plays.filter((p) => p.side === 'offense');
  const defenses = plays.filter((p) => p.side === 'defense');
  for (const o of offenses) {
    for (const d of defenses) {
      if (o.format !== d.format) continue;
      const flipped = applyMatchupFlips(o, d, { offenseFlipped: false, defenseFlip: 'auto' });
      let complete = 0;
      let sack = 0;
      let int = 0;
      let yards = 0;
      for (let seed = 1; seed <= runs; seed++) {
        const input: SimInput = {
          offense: flipped.offense,
          defense: flipped.defense,
          offenseStats: avgStats(flipped.offense, settings.presets.avg),
          defenseStats: avgStats(flipped.defense, settings.presets.avg),
          field: settings.fields[o.format],
          ballSpot: DEFAULT_BALL_SPOT,
          anticipation: 0.5,
          seed,
          noise: true,
          tuning: settings.tuning,
          routePriors: settings.routePriors,
        };
        const out = simulate(input).outcome;
        if (out.kind === 'complete') {
          complete += 1;
          yards += out.yards;
        } else if (out.kind === 'sack') sack += 1;
        else if (out.kind === 'intercepted') int += 1;
      }
      rows.push({
        offenseId: o.id,
        defenseId: d.id,
        offenseName: o.name,
        defenseName: d.name,
        runs,
        pComplete: complete / runs,
        pSack: sack / runs,
        pInt: int / runs,
        avgYards: yards / runs,
        target: isTargetPair(o, d),
      });
    }
  }
  return rows;
}

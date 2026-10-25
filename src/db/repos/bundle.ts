/** Read helpers combining tables (FR-DAT-03, §7.2 DbSnapshot). */
import { createDefaultSettings } from '@/domain/defaults';
import type { Athlete, DbSnapshot, ID, Lineup, Matchup, Play } from '@/domain/types';
import { withDbErrors } from '../errors';
import { getDb } from '../schema';

export type MatchupBundle =
  | { status: 'ok'; matchup: Matchup; offense: Play; defense: Play }
  | { status: 'missing-matchup' }
  | {
      status: 'missing-play';
      matchup: Matchup;
      missing: ('offense' | 'defense')[];
      offense?: Play;
      defense?: Play;
    };

/** Never throws for missing records; reports which side is missing (FR-DAT-03). */
export async function loadMatchupBundle(matchupId: ID): Promise<MatchupBundle> {
  return withDbErrors(async () => {
    const db = getDb();
    const matchup = await db.matchups.get(matchupId);
    if (!matchup) return { status: 'missing-matchup' };
    const [offense, defense] = await db.plays.bulkGet([matchup.offensePlayId, matchup.defensePlayId]);
    if (offense && defense) return { status: 'ok', matchup, offense, defense };
    const missing: ('offense' | 'defense')[] = [];
    if (!offense) missing.push('offense');
    if (!defense) missing.push('defense');
    const bundle: MatchupBundle = { status: 'missing-play', matchup, missing };
    if (offense) bundle.offense = offense;
    if (defense) bundle.defense = defense;
    return bundle;
  });
}

/** Settings (or defaults) + all lineups and athletes keyed by id. */
export async function loadDbSnapshot(): Promise<DbSnapshot> {
  return withDbErrors(async () => {
    const db = getDb();
    const [settings, lineups, athletes] = await Promise.all([
      db.settings.get('app'),
      db.lineups.toArray(),
      db.athletes.toArray(),
    ]);
    const lineupsById: Record<ID, Lineup> = {};
    for (const l of lineups) lineupsById[l.id] = l;
    const athletesById: Record<ID, Athlete> = {};
    for (const a of athletes) athletesById[a.id] = a;
    return { settings: settings ?? createDefaultSettings(), lineups: lineupsById, athletes: athletesById };
  });
}

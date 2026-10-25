/** Read helpers combining tables (FR-DAT-03, §7.2 DbSnapshot). */
import { notImplemented } from '@/domain/notImplemented';
import type { DbSnapshot, ID, Matchup, Play } from '@/domain/types';

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
  return notImplemented(`loadMatchupBundle ${matchupId}`);
}

/** Settings (or defaults) + all lineups and athletes keyed by id. */
export async function loadDbSnapshot(): Promise<DbSnapshot> {
  return notImplemented('loadDbSnapshot');
}

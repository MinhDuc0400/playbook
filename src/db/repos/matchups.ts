import { notImplemented } from '@/domain/notImplemented';
import type { ID, Matchup } from '@/domain/types';
import type { Repo } from './base';

export interface MatchupsRepo extends Repo<Matchup> {
  /** Matchups whose offensePlayId or defensePlayId is playId. */
  listByPlay(playId: ID): Promise<Matchup[]>;
  /** playId → number of matchups using it (FR-PB-05). */
  countByPlay(): Promise<Record<ID, number>>;
}

export const matchupsRepo: MatchupsRepo = new Proxy({} as MatchupsRepo, {
  get: (_t, key) => notImplemented(`matchupsRepo.${String(key)}`),
});

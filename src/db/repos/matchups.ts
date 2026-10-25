import type { ID, Matchup } from '@/domain/types';
import { withDbErrors } from '../errors';
import { getDb } from '../schema';
import { createRepo, type Repo } from './base';

export interface MatchupsRepo extends Repo<Matchup> {
  /** Matchups whose offensePlayId or defensePlayId is playId. */
  listByPlay(playId: ID): Promise<Matchup[]>;
  /** playId → number of matchups using it (FR-PB-05). */
  countByPlay(): Promise<Record<ID, number>>;
}

export const matchupsRepo: MatchupsRepo = {
  ...createRepo<Matchup>(() => getDb().matchups),
  listByPlay: (playId) =>
    withDbErrors(async () => {
      const db = getDb();
      const [asOffense, asDefense] = await Promise.all([
        db.matchups.where('offensePlayId').equals(playId).toArray(),
        db.matchups.where('defensePlayId').equals(playId).toArray(),
      ]);
      const byId = new Map<ID, Matchup>();
      for (const m of [...asOffense, ...asDefense]) byId.set(m.id, m);
      return [...byId.values()];
    }),
  countByPlay: () =>
    withDbErrors(async () => {
      const counts: Record<ID, number> = {};
      await getDb().matchups.each((m) => {
        counts[m.offensePlayId] = (counts[m.offensePlayId] ?? 0) + 1;
        if (m.defensePlayId !== m.offensePlayId) {
          counts[m.defensePlayId] = (counts[m.defensePlayId] ?? 0) + 1;
        }
      });
      return counts;
    }),
};

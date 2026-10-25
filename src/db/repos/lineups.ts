import type { Format, Lineup, Side } from '@/domain/types';
import { withDbErrors } from '../errors';
import { getDb } from '../schema';
import { createRepo, type Repo } from './base';

export interface LineupsRepo extends Repo<Lineup> {
  listFor(side: Side, format: Format): Promise<Lineup[]>;
}

export const lineupsRepo: LineupsRepo = {
  ...createRepo<Lineup>(() => getDb().lineups),
  listFor: (side, format) =>
    withDbErrors(() =>
      getDb()
        .lineups.where('side')
        .equals(side)
        .and((l) => l.format === format)
        .toArray(),
    ),
};

import type { ID, Install } from '@/domain/types';
import { withDbErrors } from '../errors';
import { getDb } from '../schema';
import { createRepo, type Repo } from './base';

export interface InstallsRepo extends Repo<Install> {
  /** Installs that contain an item for matchupId. */
  listByMatchup(matchupId: ID): Promise<Install[]>;
}

export const installsRepo: InstallsRepo = {
  ...createRepo<Install>(() => getDb().installs),
  listByMatchup: (matchupId) =>
    withDbErrors(() =>
      getDb()
        .installs.filter((inst) => inst.items.some((it) => it.matchupId === matchupId))
        .toArray(),
    ),
};

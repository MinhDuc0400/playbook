import { notImplemented } from '@/domain/notImplemented';
import type { ID, Install } from '@/domain/types';
import type { Repo } from './base';

export interface InstallsRepo extends Repo<Install> {
  /** Installs that contain an item for matchupId. */
  listByMatchup(matchupId: ID): Promise<Install[]>;
}

export const installsRepo: InstallsRepo = new Proxy({} as InstallsRepo, {
  get: (_t, key) => notImplemented(`installsRepo.${String(key)}`),
});

import { notImplemented } from '@/domain/notImplemented';
import type { Format, Lineup, Side } from '@/domain/types';
import type { Repo } from './base';

export interface LineupsRepo extends Repo<Lineup> {
  listFor(side: Side, format: Format): Promise<Lineup[]>;
}

export const lineupsRepo: LineupsRepo = new Proxy({} as LineupsRepo, {
  get: (_t, key) => notImplemented(`lineupsRepo.${String(key)}`),
});

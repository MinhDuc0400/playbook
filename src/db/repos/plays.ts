import { notImplemented } from '@/domain/notImplemented';
import type { ID, Play, Side } from '@/domain/types';
import type { Repo } from './base';

export interface PlaysRepo extends Repo<Play> {
  listBySide(side: Side): Promise<Play[]>;
  /** multiEntry index query on tags. */
  listByTag(tag: string): Promise<Play[]>;
  /** Distinct tags across all plays, sorted. */
  allTags(): Promise<string[]>;
  /** Copy with new id, name + " (bản sao)", fresh createdAt/updatedAt; slot ids kept. Saved. */
  duplicate(id: ID): Promise<Play>;
}

export const playsRepo: PlaysRepo = new Proxy({} as PlaysRepo, {
  get: (_t, key) => notImplemented(`playsRepo.${String(key)}`),
});

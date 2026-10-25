import { nanoid } from 'nanoid';
import type { ID, Play, Side } from '@/domain/types';
import { withDbErrors } from '../errors';
import { getDb } from '../schema';
import { createRepo, type Repo } from './base';

export interface PlaysRepo extends Repo<Play> {
  listBySide(side: Side): Promise<Play[]>;
  /** multiEntry index query on tags. */
  listByTag(tag: string): Promise<Play[]>;
  /** Distinct tags across all plays, sorted. */
  allTags(): Promise<string[]>;
  /** Copy with new id, name + " (bản sao)", fresh createdAt/updatedAt; slot ids kept. Saved. */
  duplicate(id: ID): Promise<Play>;
}

export const playsRepo: PlaysRepo = {
  ...createRepo<Play>(() => getDb().plays),
  listBySide: (side) => withDbErrors(() => getDb().plays.where('side').equals(side).toArray()),
  listByTag: (tag) => withDbErrors(() => getDb().plays.where('tags').equals(tag).distinct().toArray()),
  allTags: () =>
    withDbErrors(async () => {
      const keys = await getDb().plays.orderBy('tags').uniqueKeys();
      return keys.map(String).sort();
    }),
  duplicate: (id) =>
    withDbErrors(async () => {
      const db = getDb();
      return db.transaction('rw', db.plays, async () => {
        const src = await db.plays.get(id);
        if (!src) throw new Error(`play not found: ${id}`);
        const now = Date.now();
        const copy: Play = {
          ...structuredClone(src),
          id: nanoid(),
          name: `${src.name} (bản sao)`,
          createdAt: now,
          updatedAt: now,
        };
        await db.plays.put(copy);
        return copy;
      });
    }),
};

/** Cascading deletes (FR-DAT-02). */
import type { ID, Install, Matchup } from '@/domain/types';
import { withDbErrors } from '../errors';
import { getDb, type FlagDB } from '../schema';

export interface PlayDeleteImpact {
  matchups: Matchup[];
  /** Installs that lose items, with the ids of the items that would be removed. */
  installs: { install: Install; itemIds: ID[] }[];
}

export class PlayInUseError extends Error {
  constructor(public readonly impact: PlayDeleteImpact) {
    super('play is used by matchups');
    this.name = 'PlayInUseError';
  }
}

/** Must run inside a transaction that includes matchups (and installs when computing install impact). */
async function matchupsUsingPlay(db: FlagDB, playId: ID): Promise<Matchup[]> {
  const [asOffense, asDefense] = await Promise.all([
    db.matchups.where('offensePlayId').equals(playId).toArray(),
    db.matchups.where('defensePlayId').equals(playId).toArray(),
  ]);
  const byId = new Map<ID, Matchup>();
  for (const m of [...asOffense, ...asDefense]) byId.set(m.id, m);
  return [...byId.values()];
}

async function installImpact(db: FlagDB, matchupIds: ReadonlySet<ID>): Promise<PlayDeleteImpact['installs']> {
  if (matchupIds.size === 0) return [];
  const out: PlayDeleteImpact['installs'] = [];
  const installs = await db.installs.toArray();
  for (const install of installs) {
    const itemIds = install.items.filter((it) => matchupIds.has(it.matchupId)).map((it) => it.id);
    if (itemIds.length > 0) out.push({ install, itemIds });
  }
  return out;
}

/** Drop install items of the given matchups and re-pack `order` to 0..n-1 (sorted by old order). */
async function removeFromInstalls(db: FlagDB, matchupIds: ReadonlySet<ID>): Promise<void> {
  const now = Date.now();
  for (const { install } of await installImpact(db, matchupIds)) {
    const kept = install.items
      .filter((it) => !matchupIds.has(it.matchupId))
      .sort((a, b) => a.order - b.order)
      .map((it, i) => ({ ...it, order: i }));
    await db.installs.put({ ...install, items: kept, updatedAt: now });
  }
}

export async function getPlayDeleteImpact(playId: ID): Promise<PlayDeleteImpact> {
  return withDbErrors(async () => {
    const db = getDb();
    return db.transaction('r', db.matchups, db.installs, async () => {
      const matchups = await matchupsUsingPlay(db, playId);
      const installs = await installImpact(db, new Set(matchups.map((m) => m.id)));
      return { matchups, installs };
    });
  });
}

/**
 * Delete a play in one rw transaction over plays/matchups/installs.
 * cascade=false and impact non-empty → throws PlayInUseError, nothing written.
 * cascade=true → also deletes dependent matchups and removes their items from installs (orders re-packed 0..n-1).
 */
export async function deletePlay(playId: ID, opts: { cascade: boolean }): Promise<void> {
  const blocked = await withDbErrors(async () => {
    const db = getDb();
    return db.transaction('rw', db.plays, db.matchups, db.installs, async () => {
      const matchups = await matchupsUsingPlay(db, playId);
      if (matchups.length > 0 && !opts.cascade) {
        const installs = await installImpact(db, new Set(matchups.map((m) => m.id)));
        return { matchups, installs };
      }
      const ids = new Set(matchups.map((m) => m.id));
      await removeFromInstalls(db, ids);
      await db.matchups.bulkDelete([...ids]);
      await db.plays.delete(playId);
      return null;
    });
  });
  // thrown outside withDbErrors: a blocked delete is a domain outcome, not a storage failure
  if (blocked) throw new PlayInUseError(blocked);
}

/** Delete a matchup and remove its items from every install (one transaction). */
export async function deleteMatchup(matchupId: ID): Promise<void> {
  return withDbErrors(async () => {
    const db = getDb();
    await db.transaction('rw', db.matchups, db.installs, async () => {
      await removeFromInstalls(db, new Set([matchupId]));
      await db.matchups.delete(matchupId);
    });
  });
}

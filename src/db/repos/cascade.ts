/** Cascading deletes (FR-DAT-02). */
import { notImplemented } from '@/domain/notImplemented';
import type { ID, Install, Matchup } from '@/domain/types';

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

export async function getPlayDeleteImpact(playId: ID): Promise<PlayDeleteImpact> {
  return notImplemented(`getPlayDeleteImpact ${playId}`);
}

/**
 * Delete a play in one rw transaction over plays/matchups/installs.
 * cascade=false and impact non-empty → throws PlayInUseError, nothing written.
 * cascade=true → also deletes dependent matchups and removes their items from installs (orders re-packed 0..n-1).
 */
export async function deletePlay(playId: ID, opts: { cascade: boolean }): Promise<void> {
  return notImplemented(`deletePlay ${playId}${String(opts)}`);
}

/** Delete a matchup and remove its items from every install (one transaction). */
export async function deleteMatchup(matchupId: ID): Promise<void> {
  return notImplemented(`deleteMatchup ${matchupId}`);
}

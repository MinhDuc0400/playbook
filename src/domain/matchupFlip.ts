/** Matchup flips (SRS §6.4, FR-FLP-03, FR-FLP-04). Pure; plays are never copied into the DB. */
import { notImplemented } from './notImplemented';
import type { Matchup, Play } from './types';

/**
 * Apply `offenseFlipped` (flipPlay offense) then decide the defense flip:
 * - 'none' → no flip; 'flip' → flip;
 * - 'auto' (FR-FLP-04) → flip iff defense.alignTo === 'strength', defense.strength is 'left'|'right' and
 *   strongSideOf(alignedPlayers(offense'), computeStrength(alignedPlayers(offense'))) !== defense.strength
 *   (offense' = offense after its flip; D-09 tie-breaks).
 */
export function applyMatchupFlips(
  offense: Play,
  defense: Play,
  m: Pick<Matchup, 'offenseFlipped' | 'defenseFlip'>,
): { offense: Play; defense: Play; defenseFlipped: boolean } {
  return notImplemented(`applyMatchupFlips ${offense.id}${defense.id}${String(m)}`);
}

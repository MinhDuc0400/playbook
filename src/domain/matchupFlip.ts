/** Matchup flips (SRS §6.4, FR-FLP-03, FR-FLP-04). Pure; plays are never copied into the DB. */
import { flipPlay } from './flip';
import { alignedPlayers, computeStrength, strongSideOf } from './numbering';
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
  const flippedOffense = m.offenseFlipped ? flipPlay(offense) : offense;
  const defenseFlipped = shouldFlipDefense(flippedOffense, defense, m.defenseFlip);
  return {
    offense: flippedOffense,
    defense: defenseFlipped ? flipPlay(defense) : defense,
    defenseFlipped,
  };
}

function shouldFlipDefense(offense: Play, defense: Play, mode: Matchup['defenseFlip']): boolean {
  if (mode === 'flip') return true;
  if (mode === 'none') return false;
  if (defense.alignTo !== 'strength') return false;
  if (defense.strength !== 'left' && defense.strength !== 'right') return false;
  const aligned = alignedPlayers(offense);
  return strongSideOf(aligned, computeStrength(aligned)) !== defense.strength;
}

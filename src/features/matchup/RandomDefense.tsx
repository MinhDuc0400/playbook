/**
 * Random defense (FR-RD-01..03): pick a random same-format defense (optionally filtered by tag), hide its
 * name and the zone/man overlays while hidden, let the user guess a coverage from the cov:* tags, reveal on
 * "Hiện" or at the end of the animation, show right/wrong.
 */
import type { Play } from '@/domain/types';

export interface RandomDefenseProps {
  offense: Play;
  /** Called with the chosen defense play id; the page swaps the matchup's defense. */
  onPick(defensePlayId: string): void;
  /** Current defense of the matchup (to know what to reveal). */
  defense: Play | null;
  hidden: boolean;
  onHiddenChange(hidden: boolean): void;
  /** True once the animation reached its end (auto reveal). */
  ended: boolean;
}

export function RandomDefense(_props: RandomDefenseProps): JSX.Element | null {
  return null;
}

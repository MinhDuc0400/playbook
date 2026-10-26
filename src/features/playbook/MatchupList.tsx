/** Matchup tab of the Playbook (FR-PB-04): double thumbnails, filter by offense / defense play. */
import type { Play, Settings } from '@/domain/types';

export interface MatchupListProps {
  plays: readonly Play[];
  settings: Settings;
}

export function MatchupList(_props: MatchupListProps): JSX.Element | null {
  return null;
}

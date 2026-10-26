/** FR-ATH-01 / FR-MU-09: selected player → Kém / TB / Hay buttons writing Matchup.overrides; keys 1/2/3. */
import type { DbSnapshot, Matchup } from '@/domain/types';
import type { BuiltSim } from './buildSimInput';

export interface PlayerPanelProps {
  matchup: Matchup;
  built: BuiltSim;
  snapshot: DbSnapshot;
  onChange(m: Matchup): void;
}

export function PlayerPanel(_props: PlayerPanelProps): JSX.Element | null {
  return null;
}

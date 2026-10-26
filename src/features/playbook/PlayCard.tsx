/**
 * One play in the Playbook grid (FR-PB-01, FR-PB-03, FR-PB-05): thumbnail, name, side/format/formation,
 * tags, matchup count, actions open / duplicate / delete (DeletePlayDialog, FR-DAT-02) / create matchup.
 */
import type { FieldConfig, Play } from '@/domain/types';

export interface PlayCardProps {
  play: Play;
  field: FieldConfig;
  matchupCount: number;
}

export function PlayCard(_props: PlayCardProps): JSX.Element | null {
  return null;
}

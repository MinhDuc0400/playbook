/**
 * Field for a matchup (FR-MU-05/06, FR-ATH-02): FieldStage + per-frame PlayerTokens (positions only from
 * frameAt(result.frames, t)), overlays (overlays.tsx), separation labels, click to select a player.
 */
import type { BallSpot, FieldConfig, SimResult } from '@/domain/types';
import type { BuiltSim } from './buildSimInput';
import type { Preset } from '@/domain/types';

export interface MatchupFieldProps {
  built: BuiltSim;
  result: SimResult;
  t: number;
  field: FieldConfig;
  ballSpot: BallSpot;
  /** Ring level per slot id (FR-ATH-02). */
  levels: Record<string, Preset | 'custom'>;
  /** Random defense (phase 6) hides zones/man lines. */
  hideDefenseOverlays?: boolean;
  theme?: 'normal' | 'contrast';
}

export function MatchupField(_props: MatchupFieldProps): JSX.Element | null {
  return null;
}

/**
 * Player token (§12.2): offense = circle with the label inside; defense = triangle with the label beside;
 * ring colour by level (FR-ATH-02: weak red, avg grey, good green, custom purple); rusher hand; leverage dot;
 * progression badge. Position via toScreen from FieldContext.
 */
import type { ID, Leverage, Point, Preset, Side } from '@/domain/types';

export interface PlayerTokenProps {
  id: ID;
  side: Side;
  label: string;
  pos: Point; // yards
  selected?: boolean;
  /** Ring colour; omitted → no ring. */
  level?: Preset | 'custom';
  /** Defense: small dot offset toward inside/outside (needs `insideSign`: +1 when inside is +x). */
  leverage?: Leverage;
  insideSign?: 1 | -1;
  /** Designated rusher: raised-hand marker (FR-DEF-04). */
  rusher?: boolean;
  /** Ghost offense in the defense editor: faded, not draggable. */
  ghost?: boolean;
  /** Progression order badge 1, 2, 3… (FR-OFF-04). */
  progressionIndex?: number;
  dimmed?: boolean;
  onPointerDown?: (e: React.PointerEvent<SVGGElement>) => void;
}

export function PlayerToken(_props: PlayerTokenProps): JSX.Element | null {
  return null;
}

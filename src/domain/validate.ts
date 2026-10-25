/** Editor warnings panel rules (FR-ED-07). Warnings never block saving. Pure. */
import { notImplemented } from './notImplemented';
import type { AlignedPlayer } from './numbering';
import type { BallSpot, FieldConfig, ID, Play } from './types';

export type WarningCode =
  | 'too-few-players' // params: { count, expected }
  | 'too-many-players' // params: { count, expected }
  | 'route-out-of-bounds' // slotId; a path point outside sidelines or past the back of the end zone
  | 'wrong-side-of-los' // slotId; offense start y > 0, defense start y < 0
  | 'rusher-inside-rush-line' // slotId; rusher start y < field.rushLine
  | 'too-many-rushers' // params: { count, max }; rushers = slots with a 'rush' action
  | 'rush-delay' // slotId; rush.delay > 0 while field.rusherGoesOnSnap
  | 'catch-behind-los' // slotId; route/option whose every point (incl. start) has y ≤ 0
  | 'man-target-missing'; // slotId; man target ref does not resolve against the ghost formation

export interface PlayWarning {
  code: WarningCode;
  slotId?: ID;
  params?: Record<string, number | string>;
}

/**
 * All warnings for a play. `ballSpot` defaults to DEFAULT_BALL_SPOT. `ghost` = offense alignment to bind
 * man targets against (defense only); defaults to defaultGhostFormation(play.format) players.
 * Deterministic order: play-level warnings first, then by slot order, then by code.
 */
export function validatePlay(
  play: Play,
  field: FieldConfig,
  opts?: { ballSpot?: BallSpot; ghost?: readonly AlignedPlayer[] },
): PlayWarning[] {
  return notImplemented(`validatePlay ${play.id}${field.format}${String(opts)}`);
}

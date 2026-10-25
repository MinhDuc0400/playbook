/**
 * Field configuration per format (SRS §4.2, §4.3, D-12) and ball-relative field helpers.
 * Coordinates: yards, origin = ball on the LOS, x right, y downfield (toward the defense).
 */
import type { BallSpot, FieldConfig, Format, Point } from './types';

const FIELD_5V5: FieldConfig = {
  format: '5v5',
  playersPerSide: 5,
  width: 30,
  length: 50,
  endZoneDepth: 10,
  lineToGain: [25],
  noRunZones: [
    { from: 20, to: 25 },
    { from: 45, to: 50 },
  ],
  rushLine: 7,
  maxRushers: 2,
  rusherGoesOnSnap: true,
  qbCanCrossLOS: false,
  centerEligible: true,
  passClock: 7,
  catchBeyondLOS: true,
  contact: 'none',
};

/** Fresh copy of the default field configs (5v5 = NFL FLAG; 7v7/custom copied from 5v5, D-12). */
export function createDefaultFields(): Record<Format, FieldConfig> {
  const copy = (over: Partial<FieldConfig>): FieldConfig => ({
    ...FIELD_5V5,
    lineToGain: [...FIELD_5V5.lineToGain],
    noRunZones: FIELD_5V5.noRunZones.map((z) => ({ ...z })),
    ...over,
  });
  return {
    '5v5': copy({}),
    '7v7': copy({ format: '7v7', playersPerSide: 7, width: 40 }),
    custom: copy({ format: 'custom' }),
  };
}

export const DEFAULT_BALL_SPOT: BallSpot = { x: 0, yardLine: 15 };

export interface FieldBounds {
  minX: number; // left sideline
  maxX: number; // right sideline
  minY: number; // back of own end zone
  maxY: number; // back of opponent end zone
}

/** Sidelines relative to the ball: x ∈ [−W/2 − ballSpot.x, W/2 − ballSpot.x]. */
export function sidelineBounds(field: FieldConfig, ballSpot: BallSpot): { minX: number; maxX: number } {
  void field;
  void ballSpot;
  throw new Error('not implemented');
}

/** y of a yard line (yd from own goal line) relative to the LOS. */
export function yardLineToY(ballSpot: BallSpot, yardLine: number): number {
  void ballSpot;
  void yardLine;
  throw new Error('not implemented');
}

/** Inverse of yardLineToY. */
export function yToYardLine(ballSpot: BallSpot, y: number): number {
  void ballSpot;
  void y;
  throw new Error('not implemented');
}

/** y of the opponent goal line relative to the LOS (= field.length − yardLine). */
export function goalLineY(field: FieldConfig, ballSpot: BallSpot): number {
  void field;
  void ballSpot;
  throw new Error('not implemented');
}

/** Whole playable area incl. both end zones, ball-relative. */
export function fieldBounds(field: FieldConfig, ballSpot: BallSpot): FieldBounds {
  void field;
  void ballSpot;
  throw new Error('not implemented');
}

/** True when p lies inside sidelines and end-zone backs (inclusive). */
export function isInsideField(p: Point, field: FieldConfig, ballSpot: BallSpot): boolean {
  void p;
  void field;
  void ballSpot;
  throw new Error('not implemented');
}

/** Clamp p into fieldBounds. */
export function clampToField(p: Point, field: FieldConfig, ballSpot: BallSpot): Point {
  void p;
  void field;
  void ballSpot;
  throw new Error('not implemented');
}

/** True when ballSpot.yardLine lies inside any no-run zone (inclusive) → "Chỉ được chuyền" badge. */
export function isInNoRunZone(field: FieldConfig, ballSpot: BallSpot): boolean {
  void field;
  void ballSpot;
  throw new Error('not implemented');
}

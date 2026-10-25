/**
 * Yard ↔ pixel conversion (FR-FLD-02, NFR-ARC-05). The ONLY place that converts coordinates.
 * Screen: x right, y down. Field: x right, y downfield = screen up (offense attacks upward, FR-FLD-04).
 */
import { notImplemented } from '@/domain/notImplemented';
import type { BallSpot, FieldConfig, Point } from '@/domain/types';

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface Viewport {
  width: number; // px
  height: number; // px
  scale: number; // px per yard
  center: Point; // field point shown at the viewport centre
}

export function toScreen(p: Point, vp: Viewport): ScreenPoint {
  return notImplemented(`toScreen ${p.x}${vp.width}`);
}

export function toField(px: ScreenPoint, vp: Viewport): Point {
  return notImplemented(`toField ${px.x}${vp.width}`);
}

/** Largest scale that fits the rect [minX,maxX]×[minY,maxY] (+ padding px) and centres it. */
export function fitViewport(
  width: number,
  height: number,
  rect: { minX: number; maxX: number; minY: number; maxY: number },
  padding?: number,
): Viewport {
  return notImplemented(`fitViewport ${width}${height}${String(rect)}${padding}`);
}

/** FR-FLD-04: from 10 yd behind to 25 yd beyond the LOS, full field width. */
export function defaultViewport(
  width: number,
  height: number,
  field: FieldConfig,
  ballSpot: BallSpot,
): Viewport {
  return notImplemented(`defaultViewport ${width}${height}${String(field)}${String(ballSpot)}`);
}

/** Zoom by factor keeping the field point under `anchor` fixed. Scale clamped to [2, 200] px/yd. */
export function zoomAt(vp: Viewport, anchor: ScreenPoint, factor: number): Viewport {
  return notImplemented(`zoomAt ${vp.width}${anchor.x}${factor}`);
}

/** Pan by a screen delta in px. */
export function panBy(vp: Viewport, dx: number, dy: number): Viewport {
  return notImplemented(`panBy ${vp.width}${dx}${dy}`);
}

/** Length in px of `yards`. */
export function yardsToPx(yards: number, vp: Viewport): number {
  return notImplemented(`yardsToPx ${yards}${vp.width}`);
}

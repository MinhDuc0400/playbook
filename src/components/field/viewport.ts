/**
 * Yard ↔ pixel conversion (FR-FLD-02, NFR-ARC-05). The ONLY place that converts coordinates.
 * Screen: x right, y down. Field: x right, y downfield = screen up (offense attacks upward, FR-FLD-04).
 */
import { sidelineBounds } from '@/domain/field';
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

export const MIN_SCALE = 2;
export const MAX_SCALE = 200;
const DEFAULT_PADDING = 16;

export function toScreen(p: Point, vp: Viewport): ScreenPoint {
  return {
    x: vp.width / 2 + (p.x - vp.center.x) * vp.scale,
    y: vp.height / 2 - (p.y - vp.center.y) * vp.scale,
  };
}

export function toField(px: ScreenPoint, vp: Viewport): Point {
  return {
    x: vp.center.x + (px.x - vp.width / 2) / vp.scale,
    y: vp.center.y - (px.y - vp.height / 2) / vp.scale,
  };
}

/** Largest scale that fits the rect [minX,maxX]×[minY,maxY] (+ padding px) and centres it. */
export function fitViewport(
  width: number,
  height: number,
  rect: { minX: number; maxX: number; minY: number; maxY: number },
  padding: number = DEFAULT_PADDING,
): Viewport {
  const rw = Math.max(rect.maxX - rect.minX, 1e-6);
  const rh = Math.max(rect.maxY - rect.minY, 1e-6);
  const sx = (width - 2 * padding) / rw;
  const sy = (height - 2 * padding) / rh;
  const scale = Math.max(Math.min(sx, sy), 1e-6);
  return {
    width,
    height,
    scale,
    center: { x: (rect.minX + rect.maxX) / 2, y: (rect.minY + rect.maxY) / 2 },
  };
}

/** FR-FLD-04: from 10 yd behind to 25 yd beyond the LOS, full field width. */
export function defaultViewport(
  width: number,
  height: number,
  field: FieldConfig,
  ballSpot: BallSpot,
): Viewport {
  const { minX, maxX } = sidelineBounds(field, ballSpot);
  return fitViewport(width, height, { minX, maxX, minY: -10, maxY: 25 });
}

/** Zoom by factor keeping the field point under `anchor` fixed. Scale clamped to [2, 200] px/yd. */
export function zoomAt(vp: Viewport, anchor: ScreenPoint, factor: number): Viewport {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, vp.scale * factor));
  const fixed = toField(anchor, vp);
  return {
    ...vp,
    scale,
    center: {
      x: fixed.x - (anchor.x - vp.width / 2) / scale,
      y: fixed.y + (anchor.y - vp.height / 2) / scale,
    },
  };
}

/** Pan by a screen delta in px (content follows the pointer, so the centre moves opposite). */
export function panBy(vp: Viewport, dx: number, dy: number): Viewport {
  return {
    ...vp,
    center: { x: vp.center.x - dx / vp.scale, y: vp.center.y + dy / vp.scale },
  };
}

/** Length in px of `yards`. */
export function yardsToPx(yards: number, vp: Viewport): number {
  return yards * vp.scale;
}

export interface RectLike {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Field-coordinate rectangle currently visible in the viewport. */
export function visibleRect(vp: Viewport): RectLike {
  const hx = vp.width / 2 / vp.scale;
  const hy = vp.height / 2 / vp.scale;
  return {
    minX: vp.center.x - hx,
    maxX: vp.center.x + hx,
    minY: vp.center.y - hy,
    maxY: vp.center.y + hy,
  };
}

/** Same viewport, re-centred on `center` (unclamped). */
export function viewportForCenter(vp: Viewport, center: Point): Viewport {
  return { ...vp, center: { x: center.x, y: center.y } };
}

function clampAxis(center: number, half: number, min: number, max: number): number {
  const lo = min + half;
  const hi = max - half;
  if (lo > hi) return (min + max) / 2;
  return Math.min(hi, Math.max(lo, center));
}

/**
 * Keep the view on the field: can't zoom out past "whole rect + margin", can't exceed MAX_SCALE, and the
 * visible area never leaves rect ± marginYd (when it is smaller than that; otherwise it is centred).
 */
export function clampViewport(vp: Viewport, rect: RectLike, marginYd = 2): Viewport {
  const rw = Math.max(rect.maxX - rect.minX + 2 * marginYd, 1e-6);
  const rh = Math.max(rect.maxY - rect.minY + 2 * marginYd, 1e-6);
  const minScale = Math.min(vp.width / rw, vp.height / rh);
  const scale = Math.min(MAX_SCALE, Math.max(minScale, vp.scale));
  const hx = vp.width / 2 / scale;
  const hy = vp.height / 2 / scale;
  return {
    ...vp,
    scale,
    center: {
      x: clampAxis(vp.center.x, hx, rect.minX - marginYd, rect.maxX + marginYd),
      y: clampAxis(vp.center.y, hy, rect.minY - marginYd, rect.maxY + marginYd),
    },
  };
}

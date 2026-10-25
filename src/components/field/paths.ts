/** SVG path builders in SCREEN space (inputs already converted with toScreen). Pure. */
import { notImplemented } from '@/domain/notImplemented';
import type { ScreenPoint } from './viewport';

/**
 * Polyline through pts; vertices i (1 ≤ i ≤ n−2) with smooth[i−1] true are rounded with a quadratic
 * curve of radius ≤ cornerRadius px (smooth[] is per path point, pts[0] is the start). Uses d3-shape
 * `line()` for straight runs if convenient.
 */
export function routePathD(
  pts: readonly ScreenPoint[],
  smooth: readonly boolean[],
  cornerRadius?: number,
): string {
  return notImplemented(`routePathD ${pts.length}${smooth.length}${String(cornerRadius)}`);
}

/** Zigzag polyline along pts (motion, §12.2 "Nét đứt zigzag"): amplitude px, wavelength px. */
export function zigzagD(pts: readonly ScreenPoint[], amplitude?: number, wavelength?: number): string {
  return notImplemented(`zigzagD ${pts.length}${String(amplitude)}${String(wavelength)}`);
}

/** Triangle arrowhead at the end of the last non-zero segment of pts, as an SVG `points` string. */
export function arrowHeadPoints(pts: readonly ScreenPoint[], size?: number): string {
  return notImplemented(`arrowHeadPoints ${pts.length}${String(size)}`);
}

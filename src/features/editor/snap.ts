/** Grid snapping for the editor (FR-ED-03): 0.5 yd grid, disabled by the setting or by holding Alt. */
import { snapToGrid } from '@/domain/geometry';
import type { Point } from '@/domain/types';

export const SNAP_STEP = 0.5; // yd

export function snapPoint(raw: Point, opts: { snap: boolean; alt: boolean }): Point {
  if (!opts.snap || opts.alt) return { x: raw.x, y: raw.y };
  return snapToGrid(raw, SNAP_STEP);
}

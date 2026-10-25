/**
 * Zone presets (SRS §5.3 ZonePresetId, FR-DEF-03). Polygons are ball-relative yards for a field of width W:
 * the x values below are for W = 30 and scale by W / 30; y values are fixed depths from the LOS.
 *
 * | id | x range (W=30) | y range | default dropPoint |
 * | deep-half-L | [−15, 0] | [10, 30] | (−7.5, 15) |      deep-half-R mirrored
 * | deep-third-L | [−15, −5] | [10, 30] | (−10, 15) |   deep-third-R mirrored
 * | deep-third-M | [−5, 5] | [10, 30] | (0, 16) |
 * | deep-middle | [−7, 7] | [10, 30] | (0, 14) |
 * | flat-L | [−15, −8] | [0, 7] | (−10, 5) |            flat-R mirrored
 * | hook-L | [−8, −1] | [3, 10] | (−4, 7) |             hook-R mirrored
 * | hook-M | [−4, 4] | [3, 10] | (0, 6) |
 * | curl-flat-L | [−15, −4] | [0, 12] | (−9, 7) |       curl-flat-R mirrored
 * Polygons are axis-aligned rectangles listed counter-clockwise from the bottom-left corner.
 */
import { notImplemented } from './notImplemented';
import type { FieldConfig, LateralSide, Point, ZoneAction, ZonePresetId } from './types';

export type ZoneKind = 'deep' | 'flat' | 'hook' | 'curl' | 'custom';

export interface ZoneShape {
  polygon: Point[];
  dropPoint: Point;
}

export function zonePreset(id: ZonePresetId, field: FieldConfig): ZoneShape {
  return notImplemented(`zonePreset ${id}${field.width}`);
}

/** Polygon of a ZoneAction zone (preset → zonePreset polygon; custom → its polygon copy). */
export function zonePolygon(zone: ZoneAction['zone'], field: FieldConfig): Point[] {
  return notImplemented(`zonePolygon ${String(zone)}${field.width}`);
}

/** deep-*, flat-*, hook-*, curl-flat-* → kind; custom polygon → 'deep' when its min y ≥ 8, else 'custom'. */
export function zoneKind(zone: ZoneAction['zone']): ZoneKind {
  return notImplemented(`zoneKind ${String(zone)}`);
}

/** §8.6 zone pha 2: deep zones pick the deepest receiver, shallow ones the closest. */
export function isDeepZone(zone: ZoneAction['zone']): boolean {
  return notImplemented(`isDeepZone ${String(zone)}`);
}

/** §8.2.3 fallback: hook zone on the same side as x (x < −0.25 → hook-L, x > 0.25 → hook-R, else hook-M). */
export function hookZoneForX(x: number): ZonePresetId {
  return notImplemented(`hookZoneForX ${x}`);
}

/** Side of a preset (-L → 'left', -R → 'right', middle → null). */
export function zoneSide(id: ZonePresetId): LateralSide | null {
  return notImplemented(`zoneSide ${id}`);
}

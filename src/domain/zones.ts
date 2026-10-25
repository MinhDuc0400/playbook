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
import type { FieldConfig, LateralSide, Point, ZoneAction, ZonePresetId } from './types';

export type ZoneKind = 'deep' | 'flat' | 'hook' | 'curl' | 'custom';

export interface ZoneShape {
  polygon: Point[];
  dropPoint: Point;
}

interface PresetSpec {
  /** x range for W = 30 (left presets / middle presets as listed). */
  x: [number, number];
  y: [number, number];
  drop: Point;
}

/** Left / middle specs; right presets mirror the left ones across x = 0. */
const SPECS: Record<ZonePresetId, PresetSpec> = {
  'deep-half-L': { x: [-15, 0], y: [10, 30], drop: { x: -7.5, y: 15 } },
  'deep-half-R': { x: [0, 15], y: [10, 30], drop: { x: 7.5, y: 15 } },
  'deep-third-L': { x: [-15, -5], y: [10, 30], drop: { x: -10, y: 15 } },
  'deep-third-M': { x: [-5, 5], y: [10, 30], drop: { x: 0, y: 16 } },
  'deep-third-R': { x: [5, 15], y: [10, 30], drop: { x: 10, y: 15 } },
  'deep-middle': { x: [-7, 7], y: [10, 30], drop: { x: 0, y: 14 } },
  'flat-L': { x: [-15, -8], y: [0, 7], drop: { x: -10, y: 5 } },
  'flat-R': { x: [8, 15], y: [0, 7], drop: { x: 10, y: 5 } },
  'hook-L': { x: [-8, -1], y: [3, 10], drop: { x: -4, y: 7 } },
  'hook-R': { x: [1, 8], y: [3, 10], drop: { x: 4, y: 7 } },
  'hook-M': { x: [-4, 4], y: [3, 10], drop: { x: 0, y: 6 } },
  'curl-flat-L': { x: [-15, -4], y: [0, 12], drop: { x: -9, y: 7 } },
  'curl-flat-R': { x: [4, 15], y: [0, 12], drop: { x: 9, y: 7 } },
};

/** `v * k` without producing -0. */
function sx(v: number, k: number): number {
  const r = v * k;
  return r === 0 ? 0 : r;
}

export function zonePreset(id: ZonePresetId, field: FieldConfig): ZoneShape {
  const spec = SPECS[id];
  const k = field.width / 30;
  const x0 = sx(spec.x[0], k);
  const x1 = sx(spec.x[1], k);
  const [y0, y1] = spec.y;
  return {
    polygon: [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ],
    dropPoint: { x: sx(spec.drop.x, k), y: spec.drop.y },
  };
}

/** Polygon of a ZoneAction zone (preset → zonePreset polygon; custom → its polygon copy). */
export function zonePolygon(zone: ZoneAction['zone'], field: FieldConfig): Point[] {
  if (typeof zone === 'string') return zonePreset(zone, field).polygon;
  return zone.polygon.map((p) => ({ x: p.x, y: p.y }));
}

/** deep-*, flat-*, hook-*, curl-flat-* → kind; custom polygon → 'deep' when its min y ≥ 8, else 'custom'. */
export function zoneKind(zone: ZoneAction['zone']): ZoneKind {
  if (typeof zone === 'string') {
    if (zone.startsWith('deep-')) return 'deep';
    if (zone.startsWith('flat-')) return 'flat';
    if (zone.startsWith('hook-')) return 'hook';
    return 'curl';
  }
  if (zone.polygon.length === 0) return 'custom';
  const minY = Math.min(...zone.polygon.map((p) => p.y));
  return minY >= 8 ? 'deep' : 'custom';
}

/** §8.6 zone pha 2: deep zones pick the deepest receiver, shallow ones the closest. */
export function isDeepZone(zone: ZoneAction['zone']): boolean {
  return zoneKind(zone) === 'deep';
}

/** §8.2.3 fallback: hook zone on the same side as x (x < −0.25 → hook-L, x > 0.25 → hook-R, else hook-M). */
export function hookZoneForX(x: number): ZonePresetId {
  if (x < -0.25) return 'hook-L';
  if (x > 0.25) return 'hook-R';
  return 'hook-M';
}

/** Side of a preset (-L → 'left', -R → 'right', middle → null). */
export function zoneSide(id: ZonePresetId): LateralSide | null {
  if (id.endsWith('-L')) return 'left';
  if (id.endsWith('-R')) return 'right';
  return null;
}

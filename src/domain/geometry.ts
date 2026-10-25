/** Pure 2D geometry in yards (SRS §3.2 geometry.ts): vectors, paths, interpolation, cut angles. */
import type { Point } from './types';

export const EPS = 1e-9;

export function vec(x: number, y: number): Point {
  return { x, y };
}
export function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}
export function sub(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}
export function scale(a: Point, k: number): Point {
  return { x: a.x * k, y: a.y * k };
}
export function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}
/** z of the 2D cross product a × b. */
export function cross(a: Point, b: Point): number {
  return a.x * b.y - a.y * b.x;
}
export function length(a: Point): number {
  return Math.hypot(a.x, a.y);
}
export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
/** Unit vector; returns {0,0} for a zero vector. */
export function normalize(a: Point): Point {
  const len = length(a);
  if (len < EPS) return { x: 0, y: 0 };
  return { x: a.x / len, y: a.y / len };
}
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
export function lerpPoint(a: Point, b: Point, t: number): Point {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}
export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
export function pointsEqual(a: Point, b: Point, eps = 1e-6): boolean {
  return Math.abs(a.x - b.x) <= eps && Math.abs(a.y - b.y) <= eps;
}

/** Unsigned angle between two direction vectors, degrees in [0, 180]. 0 when either is zero-length. */
export function angleBetween(a: Point, b: Point): number {
  if (length(a) < EPS || length(b) < EPS) return 0;
  // atan2 of |cross| and dot is stable near 0° and 180° (unlike acos).
  const deg = (Math.atan2(Math.abs(cross(a, b)), dot(a, b)) * 180) / Math.PI;
  return clamp(deg, 0, 180);
}

/** Heading change at `at` when going prev → at → next, degrees in [0, 180]. */
export function turnAngle(prev: Point, at: Point, next: Point): number {
  return angleBetween(sub(at, prev), sub(next, at));
}

/** Total length of a polyline. */
export function pathLength(points: readonly Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += distance(points[i - 1] as Point, points[i] as Point);
  }
  return total;
}

/** Point at arc-length d along a polyline (clamped to its ends). */
export function pointAtDistance(points: readonly Point[], d: number): Point {
  const first = points[0];
  if (first === undefined) throw new Error('pointAtDistance: empty path');
  if (points.length === 1 || d <= 0) return first;
  let remaining = d;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1] as Point;
    const b = points[i] as Point;
    const seg = distance(a, b);
    if (seg >= EPS && remaining <= seg) return lerpPoint(a, b, remaining / seg);
    remaining -= seg;
  }
  return points[points.length - 1] as Point;
}

/** Closest point on segment ab to p, with parameter t ∈ [0,1]. */
export function closestPointOnSegment(
  p: Point,
  a: Point,
  b: Point,
): { point: Point; t: number; dist: number } {
  const ab = sub(b, a);
  const len2 = dot(ab, ab);
  const t = len2 < EPS ? 0 : clamp(dot(sub(p, a), ab) / len2, 0, 1);
  const point = t === 0 ? { x: a.x, y: a.y } : t === 1 ? { x: b.x, y: b.y } : lerpPoint(a, b, t);
  return { point, t, dist: distance(p, point) };
}

/**
 * Closest segment of a polyline to p. Returns the index i of segment (points[i], points[i+1]),
 * the closest point and its distance.
 */
export function closestSegment(
  points: readonly Point[],
  p: Point,
): { index: number; point: Point; dist: number } | null {
  if (points.length < 2) return null;
  let best: { index: number; point: Point; dist: number } | null = null;
  for (let i = 0; i < points.length - 1; i++) {
    const r = closestPointOnSegment(p, points[i] as Point, points[i + 1] as Point);
    if (best === null || r.dist < best.dist) best = { index: i, point: r.point, dist: r.dist };
  }
  return best;
}

/** Even-odd point-in-polygon test (boundary counts as inside). */
export function pointInPolygon(p: Point, polygon: readonly Point[]): boolean {
  const n = polygon.length;
  if (n === 0) return false;
  for (let i = 0; i < n; i++) {
    const a = polygon[i] as Point;
    const b = polygon[(i + 1) % n] as Point;
    if (closestPointOnSegment(p, a, b).dist <= EPS) return true;
  }
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = polygon[i] as Point;
    const b = polygon[j] as Point;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/** Distance from p to a polygon's boundary; 0 when inside. */
export function distanceToPolygon(p: Point, polygon: readonly Point[]): number {
  if (polygon.length === 0) return Infinity;
  if (pointInPolygon(p, polygon)) return 0;
  let best = Infinity;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const d = closestPointOnSegment(p, polygon[i] as Point, polygon[(i + 1) % n] as Point).dist;
    if (d < best) best = d;
  }
  return best;
}

/** Area-weighted centroid of a simple polygon. */
export function polygonCentroid(polygon: readonly Point[]): Point {
  const n = polygon.length;
  if (n === 0) return { x: 0, y: 0 };
  let a2 = 0; // twice the signed area
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    const p = polygon[i] as Point;
    const q = polygon[(i + 1) % n] as Point;
    const w = cross(p, q);
    a2 += w;
    cx += (p.x + q.x) * w;
    cy += (p.y + q.y) * w;
  }
  if (Math.abs(a2) < EPS) {
    const sum = polygon.reduce((s, p) => add(s, p), { x: 0, y: 0 });
    return scale(sum, 1 / n);
  }
  return { x: cx / (3 * a2), y: cy / (3 * a2) };
}

function noNegZero(v: number): number {
  return v === 0 ? 0 : v;
}

/** Round both coordinates to the nearest multiple of step (default 0.5 yd, FR-ED-03). */
export function snapToGrid(p: Point, step = 0.5): Point {
  return {
    x: noNegZero(Math.round(p.x / step) * step),
    y: noNegZero(Math.round(p.y / step) * step),
  };
}

/** Constrain `to` so the segment from → to is a multiple of 45° (FR-OFF-01 Shift), keeping its length. */
export function snapAngle45(from: Point, to: Point): Point {
  const d = sub(to, from);
  const len = length(d);
  if (len < EPS) return to;
  const step = Math.PI / 4;
  const angle = Math.round(Math.atan2(d.y, d.x) / step) * step;
  return { x: from.x + Math.cos(angle) * len, y: from.y + Math.sin(angle) * len };
}

/** Mirror across x = 0. */
export function mirrorX(p: Point): Point {
  return { x: p.x === 0 ? 0 : -p.x, y: p.y };
}

/** Pure 2D geometry in yards (SRS §3.2 geometry.ts): vectors, paths, interpolation, cut angles. */
import { notImplemented } from './notImplemented';
import type { Point } from './types';

export const EPS = 1e-9;

export function vec(x: number, y: number): Point {
  return { x, y };
}
export function add(a: Point, b: Point): Point {
  return notImplemented(`add ${a.x}${b.x}`);
}
export function sub(a: Point, b: Point): Point {
  return notImplemented(`sub ${a.x}${b.x}`);
}
export function scale(a: Point, k: number): Point {
  return notImplemented(`scale ${a.x}${k}`);
}
export function dot(a: Point, b: Point): number {
  return notImplemented(`dot ${a.x}${b.x}`);
}
/** z of the 2D cross product a × b. */
export function cross(a: Point, b: Point): number {
  return notImplemented(`cross ${a.x}${b.x}`);
}
export function length(a: Point): number {
  return notImplemented(`length ${a.x}`);
}
export function distance(a: Point, b: Point): number {
  return notImplemented(`distance ${a.x}${b.x}`);
}
/** Unit vector; returns {0,0} for a zero vector. */
export function normalize(a: Point): Point {
  return notImplemented(`normalize ${a.x}`);
}
export function lerp(a: number, b: number, t: number): number {
  return notImplemented(`lerp ${a}${b}${t}`);
}
export function lerpPoint(a: Point, b: Point, t: number): Point {
  return notImplemented(`lerpPoint ${a.x}${b.x}${t}`);
}
export function clamp(v: number, min: number, max: number): number {
  return notImplemented(`clamp ${v}${min}${max}`);
}
export function pointsEqual(a: Point, b: Point, eps = 1e-6): boolean {
  return notImplemented(`pointsEqual ${a.x}${b.x}${eps}`);
}

/** Unsigned angle between two direction vectors, degrees in [0, 180]. 0 when either is zero-length. */
export function angleBetween(a: Point, b: Point): number {
  return notImplemented(`angleBetween ${a.x}${b.x}`);
}

/** Heading change at `at` when going prev → at → next, degrees in [0, 180]. */
export function turnAngle(prev: Point, at: Point, next: Point): number {
  return notImplemented(`turnAngle ${prev.x}${at.x}${next.x}`);
}

/** Total length of a polyline. */
export function pathLength(points: readonly Point[]): number {
  return notImplemented(`pathLength ${points.length}`);
}

/** Point at arc-length d along a polyline (clamped to its ends). */
export function pointAtDistance(points: readonly Point[], d: number): Point {
  return notImplemented(`pointAtDistance ${points.length}${d}`);
}

/** Closest point on segment ab to p, with parameter t ∈ [0,1]. */
export function closestPointOnSegment(
  p: Point,
  a: Point,
  b: Point,
): { point: Point; t: number; dist: number } {
  return notImplemented(`closestPointOnSegment ${p.x}${a.x}${b.x}`);
}

/**
 * Closest segment of a polyline to p. Returns the index i of segment (points[i], points[i+1]),
 * the closest point and its distance.
 */
export function closestSegment(
  points: readonly Point[],
  p: Point,
): { index: number; point: Point; dist: number } | null {
  return notImplemented(`closestSegment ${points.length}${p.x}`);
}

/** Even-odd point-in-polygon test (boundary counts as inside). */
export function pointInPolygon(p: Point, polygon: readonly Point[]): boolean {
  return notImplemented(`pointInPolygon ${p.x}${polygon.length}`);
}

/** Distance from p to a polygon's boundary; 0 when inside. */
export function distanceToPolygon(p: Point, polygon: readonly Point[]): number {
  return notImplemented(`distanceToPolygon ${p.x}${polygon.length}`);
}

/** Area-weighted centroid of a simple polygon. */
export function polygonCentroid(polygon: readonly Point[]): Point {
  return notImplemented(`polygonCentroid ${polygon.length}`);
}

/** Round both coordinates to the nearest multiple of step (default 0.5 yd, FR-ED-03). */
export function snapToGrid(p: Point, step = 0.5): Point {
  return notImplemented(`snapToGrid ${p.x}${step}`);
}

/** Constrain `to` so the segment from → to is a multiple of 45° (FR-OFF-01 Shift), keeping its length. */
export function snapAngle45(from: Point, to: Point): Point {
  return notImplemented(`snapAngle45 ${from.x}${to.x}`);
}

/** Mirror across x = 0. */
export function mirrorX(p: Point): Point {
  return notImplemented(`mirrorX ${p.x}`);
}

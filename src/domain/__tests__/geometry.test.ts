import { describe, expect, it } from 'vitest';
import {
  add,
  angleBetween,
  clamp,
  closestPointOnSegment,
  closestSegment,
  cross,
  distance,
  distanceToPolygon,
  dot,
  length,
  lerp,
  lerpPoint,
  mirrorX,
  normalize,
  pathLength,
  pointAtDistance,
  pointInPolygon,
  pointsEqual,
  polygonCentroid,
  scale,
  snapAngle45,
  snapToGrid,
  sub,
  turnAngle,
  vec,
} from '../geometry';

describe('vector ops', () => {
  it('add / sub / scale', () => {
    expect(add(vec(1, 2), vec(3, -4))).toEqual({ x: 4, y: -2 });
    expect(sub(vec(1, 2), vec(3, -4))).toEqual({ x: -2, y: 6 });
    expect(scale(vec(1, -2), 3)).toEqual({ x: 3, y: -6 });
  });
  it('dot / cross', () => {
    expect(dot(vec(1, 2), vec(3, 4))).toBe(11);
    expect(cross(vec(1, 0), vec(0, 1))).toBe(1);
    expect(cross(vec(0, 1), vec(1, 0))).toBe(-1);
  });
  it('length / distance', () => {
    expect(length(vec(3, 4))).toBe(5);
    expect(distance(vec(1, 1), vec(4, 5))).toBe(5);
  });
  it('normalize returns unit vector, zero for zero vector', () => {
    const n = normalize(vec(0, 5));
    expect(n.x).toBeCloseTo(0);
    expect(n.y).toBeCloseTo(1);
    expect(normalize(vec(0, 0))).toEqual({ x: 0, y: 0 });
  });
  it('lerp / lerpPoint / clamp / pointsEqual', () => {
    expect(lerp(2, 6, 0.25)).toBe(3);
    expect(lerpPoint(vec(0, 0), vec(10, -10), 0.5)).toEqual({ x: 5, y: -5 });
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
    expect(pointsEqual(vec(1, 1), vec(1 + 1e-9, 1))).toBe(true);
    expect(pointsEqual(vec(1, 1), vec(1.1, 1))).toBe(false);
    expect(pointsEqual(vec(1, 1), vec(1.1, 1), 0.2)).toBe(true);
  });
});

describe('angleBetween / turnAngle', () => {
  it('measures unsigned angles', () => {
    expect(angleBetween(vec(1, 0), vec(2, 0))).toBeCloseTo(0);
    expect(angleBetween(vec(1, 0), vec(1, 1))).toBeCloseTo(45);
    expect(angleBetween(vec(1, 0), vec(0, -3))).toBeCloseTo(90);
    expect(angleBetween(vec(1, 0), vec(-1, 0))).toBeCloseTo(180);
  });
  it('is 0 when either vector is zero', () => {
    expect(angleBetween(vec(0, 0), vec(1, 0))).toBe(0);
    expect(angleBetween(vec(1, 0), vec(0, 0))).toBe(0);
  });
  it('turnAngle of a 90 degree out cut', () => {
    expect(turnAngle(vec(0, 0), vec(0, 10), vec(8, 10))).toBeCloseTo(90);
  });
  it('turnAngle of a straight line is 0', () => {
    expect(turnAngle(vec(0, 0), vec(0, 5), vec(0, 12))).toBeCloseTo(0);
  });
  it('turnAngle of a full reversal is 180', () => {
    expect(turnAngle(vec(0, 0), vec(0, 5), vec(0, 0))).toBeCloseTo(180);
  });
});

describe('pathLength / pointAtDistance', () => {
  const path = [vec(0, 0), vec(0, 10), vec(10, 10)];
  it('pathLength sums segments', () => {
    expect(pathLength(path)).toBe(20);
    expect(pathLength([vec(1, 1)])).toBe(0);
    expect(pathLength([])).toBe(0);
  });
  it('interpolates mid-segment', () => {
    expect(pointAtDistance(path, 4)).toEqual({ x: 0, y: 4 });
    const p = pointAtDistance(path, 15);
    expect(p.x).toBeCloseTo(5);
    expect(p.y).toBeCloseTo(10);
  });
  it('clamps at both ends', () => {
    expect(pointAtDistance(path, -3)).toEqual({ x: 0, y: 0 });
    expect(pointAtDistance(path, 0)).toEqual({ x: 0, y: 0 });
    expect(pointAtDistance(path, 99)).toEqual({ x: 10, y: 10 });
  });
  it('single point returns it; empty throws', () => {
    expect(pointAtDistance([vec(2, 3)], 5)).toEqual({ x: 2, y: 3 });
    expect(() => pointAtDistance([], 1)).toThrow();
  });
  it('handles zero-length segments', () => {
    const p = pointAtDistance([vec(0, 0), vec(0, 0), vec(0, 4)], 2);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(2);
  });
});

describe('closestPointOnSegment / closestSegment', () => {
  it('projects inside the segment', () => {
    const r = closestPointOnSegment(vec(5, 3), vec(0, 0), vec(10, 0));
    expect(r.point).toEqual({ x: 5, y: 0 });
    expect(r.t).toBeCloseTo(0.5);
    expect(r.dist).toBeCloseTo(3);
  });
  it('clamps to the endpoints', () => {
    const r1 = closestPointOnSegment(vec(-4, 3), vec(0, 0), vec(10, 0));
    expect(r1.t).toBe(0);
    expect(r1.dist).toBeCloseTo(5);
    const r2 = closestPointOnSegment(vec(14, 3), vec(0, 0), vec(10, 0));
    expect(r2.t).toBe(1);
    expect(r2.point).toEqual({ x: 10, y: 0 });
  });
  it('degenerate segment', () => {
    const r = closestPointOnSegment(vec(3, 4), vec(0, 0), vec(0, 0));
    expect(r.t).toBe(0);
    expect(r.dist).toBeCloseTo(5);
  });
  it('closestSegment picks the right segment', () => {
    const path = [vec(0, 0), vec(10, 0), vec(10, 10)];
    const r = closestSegment(path, vec(11, 7));
    expect(r?.index).toBe(1);
    expect(r?.point).toEqual({ x: 10, y: 7 });
    expect(r?.dist).toBeCloseTo(1);
  });
  it('closestSegment returns null with fewer than 2 points', () => {
    expect(closestSegment([], vec(0, 0))).toBeNull();
    expect(closestSegment([vec(1, 1)], vec(0, 0))).toBeNull();
  });
});

describe('polygon', () => {
  const square = [vec(0, 0), vec(4, 0), vec(4, 4), vec(0, 4)];
  const ell = [vec(0, 0), vec(4, 0), vec(4, 2), vec(2, 2), vec(2, 4), vec(0, 4)];
  it('pointInPolygon inside / outside / on edge / on vertex', () => {
    expect(pointInPolygon(vec(2, 2), square)).toBe(true);
    expect(pointInPolygon(vec(5, 2), square)).toBe(false);
    expect(pointInPolygon(vec(4, 2), square)).toBe(true);
    expect(pointInPolygon(vec(0, 0), square)).toBe(true);
  });
  it('pointInPolygon handles a concave L-shape', () => {
    expect(pointInPolygon(vec(1, 3), ell)).toBe(true);
    expect(pointInPolygon(vec(3, 1), ell)).toBe(true);
    expect(pointInPolygon(vec(3, 3), ell)).toBe(false);
  });
  it('distanceToPolygon is 0 inside, edge distance outside', () => {
    expect(distanceToPolygon(vec(2, 2), square)).toBe(0);
    expect(distanceToPolygon(vec(7, 2), square)).toBeCloseTo(3);
    expect(distanceToPolygon(vec(7, 8), square)).toBeCloseTo(5);
    expect(distanceToPolygon(vec(3, 3), ell)).toBeCloseTo(1);
  });
  it('polygonCentroid of a rectangle (either winding)', () => {
    const rect = [vec(2, 1), vec(8, 1), vec(8, 5), vec(2, 5)];
    expect(polygonCentroid(rect).x).toBeCloseTo(5);
    expect(polygonCentroid(rect).y).toBeCloseTo(3);
    const rev = [...rect].reverse();
    expect(polygonCentroid(rev).x).toBeCloseTo(5);
    expect(polygonCentroid(rev).y).toBeCloseTo(3);
  });
  it('polygonCentroid of a degenerate polygon averages vertices', () => {
    const c = polygonCentroid([vec(0, 0), vec(2, 0), vec(4, 0)]);
    expect(c.x).toBeCloseTo(2);
    expect(c.y).toBeCloseTo(0);
  });
});

describe('snapping and mirroring', () => {
  it('snapToGrid on a 0.5 grid', () => {
    expect(snapToGrid(vec(1.26, 2.74))).toEqual({ x: 1.5, y: 2.5 });
    expect(snapToGrid(vec(-1.26, -2.74))).toEqual({ x: -1.5, y: -2.5 });
    expect(snapToGrid(vec(3.3, 0.7), 1)).toEqual({ x: 3, y: 1 });
  });
  it('snapToGrid never returns -0', () => {
    const p = snapToGrid(vec(-0.1, -0.2));
    expect(Object.is(p.x, -0)).toBe(false);
    expect(Object.is(p.y, -0)).toBe(false);
  });
  it('snapAngle45 snaps (3,1) to the horizontal keeping length', () => {
    const p = snapAngle45(vec(0, 0), vec(3, 1));
    expect(p.x).toBeCloseTo(Math.hypot(3, 1));
    expect(p.y).toBeCloseTo(0);
  });
  it('snapAngle45 snaps to a diagonal and respects the origin', () => {
    const p = snapAngle45(vec(10, 10), vec(12, 13));
    const len = Math.hypot(2, 3);
    expect(p.x).toBeCloseTo(10 + len / Math.SQRT2);
    expect(p.y).toBeCloseTo(10 + len / Math.SQRT2);
  });
  it('snapAngle45 returns `to` when from == to', () => {
    expect(snapAngle45(vec(1, 1), vec(1, 1))).toEqual({ x: 1, y: 1 });
  });
  it('mirrorX flips x only, no -0', () => {
    expect(mirrorX(vec(3, 4))).toEqual({ x: -3, y: 4 });
    expect(Object.is(mirrorX(vec(0, 4)).x, -0)).toBe(false);
  });
});

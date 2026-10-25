import { describe, expect, it } from 'vitest';
import {
  DECEL_FACTOR,
  MIN_SEPARATION,
  brakingSpeed,
  clampToSidelines,
  separateTeammates,
  stepMovement,
} from '../movement';
import type { Kinematic, MoveLimits } from '../types';

const DT = 1 / 60;
const TB: MoveLimits = { speed: 7, accel: 0.9, cutLoss: 0.35 };
const ACCEL_STEP = (TB.speed / TB.accel) * DT;
const speedOf = (k: Kinematic): number => Math.hypot(k.vel.x, k.vel.y);
const rest: Kinematic = { pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 } };
const north = { x: 0, y: 1 };

describe('stepMovement (§8.4, FR-ENG-04)', () => {
  it('accelerates from rest to ≥ 99 % of max in ~accel seconds and never exceeds max', () => {
    let k = rest;
    let reached = -1;
    for (let i = 1; i <= 120; i++) {
      const prev = speedOf(k);
      k = stepMovement(k, { heading: north, speed: 99 }, TB, DT);
      expect(speedOf(k)).toBeLessThanOrEqual(TB.speed + 1e-9);
      expect(speedOf(k) - prev).toBeLessThanOrEqual(ACCEL_STEP + 1e-9);
      if (reached < 0 && speedOf(k) >= 0.99 * TB.speed) reached = i;
    }
    const expected = Math.ceil(0.99 * TB.accel * 60);
    expect(Math.abs(reached - expected)).toBeLessThanOrEqual(2);
    expect(speedOf(k)).toBeCloseTo(TB.speed, 9);
  });

  it('moves position by the new velocity times dt', () => {
    const k = stepMovement(rest, { heading: north, speed: 7 }, TB, DT);
    expect(k.vel.y).toBeCloseTo(ACCEL_STEP, 12);
    expect(k.pos.y).toBeCloseTo(ACCEL_STEP * DT, 12);
    expect(k.pos.x).toBe(0);
  });

  it('90° cut at full speed loses cutLoss × 0.5 of speed, then one accel step', () => {
    const full: Kinematic = { pos: { x: 0, y: 0 }, vel: { x: 0, y: 7 } };
    const k = stepMovement(full, { heading: { x: 1, y: 0 }, speed: 7 }, TB, DT);
    const expected = Math.min(7, 7 * (1 - 0.35 * 0.5) + ACCEL_STEP);
    expect(speedOf(k)).toBeCloseTo(expected, 9);
    expect(k.vel.y).toBeCloseTo(0, 9);
    expect(k.vel.x).toBeGreaterThan(0);
  });

  it('180° cut loses (1 − cutLoss) of speed', () => {
    const full: Kinematic = { pos: { x: 0, y: 0 }, vel: { x: 0, y: 7 } };
    const k = stepMovement(full, { heading: { x: 0, y: -3 }, speed: 7 }, TB, DT);
    expect(speedOf(k)).toBeCloseTo(7 * (1 - 0.35) + ACCEL_STEP, 9);
    expect(k.vel.y).toBeLessThan(0);
  });

  it('no cut loss for headings within MIN_CUT_ANGLE of the velocity', () => {
    const slow: Kinematic = { pos: { x: 0, y: 0 }, vel: { x: 0, y: 3 } };
    const k = stepMovement(slow, { heading: { x: 0.001, y: 1 }, speed: 7 }, TB, DT);
    expect(speedOf(k)).toBeCloseTo(3 + ACCEL_STEP, 9);
  });

  it('zero heading decelerates at DECEL_FACTOR × accel along the current direction', () => {
    const full: Kinematic = { pos: { x: 0, y: 0 }, vel: { x: 3, y: 4 } };
    const k = stepMovement(full, { heading: { x: 0, y: 0 }, speed: 7 }, TB, DT);
    expect(speedOf(k)).toBeCloseTo(5 - DECEL_FACTOR * ACCEL_STEP, 9);
    expect(k.vel.x / k.vel.y).toBeCloseTo(0.75, 9);
  });

  it('slows to a lower desired speed at the deceleration limit and stops at 0', () => {
    let k: Kinematic = { pos: { x: 0, y: 0 }, vel: { x: 0, y: 7 } };
    k = stepMovement(k, { heading: north, speed: 3.5 }, TB, DT);
    expect(speedOf(k)).toBeCloseTo(7 - DECEL_FACTOR * ACCEL_STEP, 9);
    for (let i = 0; i < 60; i++) k = stepMovement(k, { heading: north, speed: 3.5 }, TB, DT);
    expect(speedOf(k)).toBeCloseTo(3.5, 9);
    for (let i = 0; i < 60; i++) k = stepMovement(k, { heading: { x: 0, y: 0 }, speed: 0 }, TB, DT);
    expect(k.vel).toEqual({ x: 0, y: 0 });
  });

  it('at rest with no heading stays put (no -0 velocities)', () => {
    const k = stepMovement(rest, { heading: { x: 0, y: 0 }, speed: 5 }, TB, DT);
    expect(k).toEqual({ pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 } });
  });

  it('is deterministic', () => {
    const a = stepMovement(rest, { heading: { x: 1, y: 2 }, speed: 7 }, TB, DT);
    const b = stepMovement(rest, { heading: { x: 1, y: 2 }, speed: 7 }, TB, DT);
    expect(a).toEqual(b);
  });

  it('brakingSpeed lets a mover stop within the distance', () => {
    let k: Kinematic = { pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 } };
    const target = 6;
    for (let i = 0; i < 600; i++) {
      const dist = target - k.pos.y;
      k = stepMovement(k, { heading: { x: 0, y: dist }, speed: brakingSpeed(dist, TB) }, TB, DT);
      expect(k.pos.y).toBeLessThanOrEqual(target + 0.01);
    }
    expect(Math.abs(k.pos.y - target)).toBeLessThan(0.05);
    expect(speedOf(k)).toBeLessThan(0.1);
  });
});

describe('clampToSidelines', () => {
  it('clamps x and zeroes vx on the left', () => {
    const k = clampToSidelines({ pos: { x: -16, y: 4 }, vel: { x: -3, y: 2 } }, -15, 15);
    expect(k).toEqual({ pos: { x: -15, y: 4 }, vel: { x: 0, y: 2 } });
  });
  it('clamps x and zeroes vx on the right', () => {
    const k = clampToSidelines({ pos: { x: 15.2, y: 4 }, vel: { x: 3, y: 2 } }, -15, 15);
    expect(k).toEqual({ pos: { x: 15, y: 4 }, vel: { x: 0, y: 2 } });
  });
  it('leaves an inside position untouched', () => {
    const k: Kinematic = { pos: { x: 3, y: 4 }, vel: { x: 1, y: 2 } };
    expect(clampToSidelines(k, -15, 15)).toEqual(k);
  });
});

describe('separateTeammates (D-10)', () => {
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
    Math.hypot(a.x - b.x, a.y - b.y);

  it('resolves an overlap to exactly MIN_SEPARATION, symmetric about the midpoint', () => {
    const out = separateTeammates({ a: { x: 0, y: 0 }, b: { x: 0.2, y: 0 } });
    expect(dist(out.a!, out.b!)).toBeCloseTo(MIN_SEPARATION, 9);
    expect((out.a!.x + out.b!.x) / 2).toBeCloseTo(0.1, 9);
  });
  it('splits equal positions along x by id order and is deterministic', () => {
    const input = { b: { x: 2, y: 2 }, a: { x: 2, y: 2 } };
    const out = separateTeammates(input);
    expect(out.a).toEqual({ x: 2 - MIN_SEPARATION / 2, y: 2 });
    expect(out.b).toEqual({ x: 2 + MIN_SEPARATION / 2, y: 2 });
    expect(separateTeammates(input)).toEqual(out);
  });
  it('does not move players that are far enough apart and does not mutate input', () => {
    const input = { a: { x: 0, y: 0 }, b: { x: 0.5, y: 0 }, c: { x: 5, y: 5 } };
    const out = separateTeammates(input);
    expect(out).toEqual(input);
    expect(out.a).not.toBe(input.a);
    const overlap = { a: { x: 0, y: 0 }, b: { x: 0, y: 0.1 } };
    separateTeammates(overlap);
    expect(overlap.b).toEqual({ x: 0, y: 0.1 });
  });
  it('pushes along the line between the pair', () => {
    const out = separateTeammates({ a: { x: 0, y: 0 }, b: { x: 0, y: 0.3 } });
    expect(out.a).toEqual({ x: 0, y: -0.1 });
    expect(out.b!.y).toBeCloseTo(0.4, 12);
  });
});

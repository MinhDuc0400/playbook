/** Movement model (SRS §8.4, FR-ENG-04). Pure, deterministic. */
import { EPS, angleBetween, clamp, distance, length, normalize } from '@/domain/geometry';
import type { ID, Point } from '@/domain/types';
import type { Intent, Kinematic, MoveLimits } from './types';

/** Deceleration limit = DECEL_FACTOR × max acceleration. */
export const DECEL_FACTOR = 2;
/** Heading changes below this many degrees per tick apply no cut loss (float noise). */
export const MIN_CUT_ANGLE = 0.5;
/** Teammates closer than this are pushed apart (§8.4). */
export const MIN_SEPARATION = 0.5;

/** Safety factor on the braking curve so discrete steps never overshoot the stop point. */
const BRAKE_MARGIN = 0.8;

/** Avoid -0 so deep-equality checks and serialization stay stable. */
function noNegZero(v: number): number {
  return v + 0;
}

/**
 * Highest speed (yd/s) from which `limits` can still brake to a stop within `dist` yd.
 * Helper for movers that must stand exactly on a point (route end, QB drop depth).
 */
export function brakingSpeed(dist: number, limits: MoveLimits): number {
  const decel = limits.accel > 0 ? (DECEL_FACTOR * limits.speed) / limits.accel : Infinity;
  if (!Number.isFinite(decel)) return limits.speed;
  return Math.sqrt(2 * decel * BRAKE_MARGIN * Math.max(0, dist));
}

/**
 * One tick of §8.4:
 * 1. desiredSpeed = clamp(intent.speed, 0, limits.speed); desiredDir = normalize(intent.heading).
 * 2. If current speed > 0 and desiredDir ≠ 0: θ = angleBetween(vel, desiredDir) degrees; if θ ≥ MIN_CUT_ANGLE
 *    → speed ×= (1 − cutLoss × θ / 180). Direction becomes desiredDir (instant turn, speed penalty).
 *    If desiredDir = 0 → keep the current direction and target speed 0.
 * 3. Speed moves toward desiredSpeed by at most (limits.speed / limits.accel) × dt when speeding up and
 *    DECEL_FACTOR × that when slowing down; never above limits.speed.
 * 4. pos += vel × dt (new velocity).
 */
export function stepMovement(k: Kinematic, intent: Intent, limits: MoveLimits, dt: number): Kinematic {
  const vmax = Math.max(0, limits.speed);
  const desiredDir = normalize(intent.heading);
  const hasDir = desiredDir.x !== 0 || desiredDir.y !== 0;

  let speed = length(k.vel);
  let dir: Point = speed > EPS ? { x: k.vel.x / speed, y: k.vel.y / speed } : { x: 0, y: 0 };
  if (speed <= EPS) speed = 0;

  let target = clamp(intent.speed, 0, vmax);
  if (hasDir) {
    if (speed > 0) {
      const theta = angleBetween(k.vel, desiredDir);
      if (theta >= MIN_CUT_ANGLE) speed *= 1 - clamp(limits.cutLoss, 0, 1) * (theta / 180);
    }
    dir = desiredDir;
  } else {
    target = 0;
  }

  const accelRate = limits.accel > 0 ? vmax / limits.accel : Infinity;
  if (target > speed) speed = Math.min(target, speed + accelRate * dt);
  else speed = Math.max(target, speed - DECEL_FACTOR * accelRate * dt);
  speed = Math.min(speed, vmax);

  const vel = { x: noNegZero(dir.x * speed), y: noNegZero(dir.y * speed) };
  return {
    pos: { x: noNegZero(k.pos.x + vel.x * dt), y: noNegZero(k.pos.y + vel.y * dt) },
    vel,
  };
}

/** Clamp x into [minX, maxX] (sidelines, §8.4). If clamped, zero the x velocity component. */
export function clampToSidelines(k: Kinematic, minX: number, maxX: number): Kinematic {
  if (k.pos.x < minX) return { pos: { x: minX, y: k.pos.y }, vel: { x: 0, y: k.vel.y } };
  if (k.pos.x > maxX) return { pos: { x: maxX, y: k.pos.y }, vel: { x: 0, y: k.vel.y } };
  return { pos: { x: k.pos.x, y: k.pos.y }, vel: { x: k.vel.x, y: k.vel.y } };
}

/**
 * Push apart players of the same group closer than MIN_SEPARATION (D-10: teammates only).
 * Each overlapping pair moves half the overlap each, along the line between them (equal positions:
 * split along x by id order). Single pass in id order; deterministic. Returns new positions.
 */
export function separateTeammates(positions: Readonly<Record<ID, Point>>): Record<ID, Point> {
  const ids = Object.keys(positions).sort();
  const out: Record<ID, Point> = {};
  for (const id of ids) {
    const p = positions[id] as Point;
    out[id] = { x: p.x, y: p.y };
  }
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = out[ids[i] as ID] as Point;
      const b = out[ids[j] as ID] as Point;
      const d = distance(a, b);
      if (d >= MIN_SEPARATION) continue;
      const half = (MIN_SEPARATION - d) / 2;
      // Lower id goes to -x when the positions coincide.
      const ux = d < EPS ? 1 : (b.x - a.x) / d;
      const uy = d < EPS ? 0 : (b.y - a.y) / d;
      a.x -= ux * half;
      a.y -= uy * half;
      b.x += ux * half;
      b.y += uy * half;
    }
  }
  return out;
}

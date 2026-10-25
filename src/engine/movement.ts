/** Movement model (SRS §8.4, FR-ENG-04). Pure, deterministic. */
import { notImplemented } from '@/domain/notImplemented';
import type { ID, Point } from '@/domain/types';
import type { Intent, Kinematic, MoveLimits } from './types';

/** Deceleration limit = DECEL_FACTOR × max acceleration. */
export const DECEL_FACTOR = 2;
/** Heading changes below this many degrees per tick apply no cut loss (float noise). */
export const MIN_CUT_ANGLE = 0.5;
/** Teammates closer than this are pushed apart (§8.4). */
export const MIN_SEPARATION = 0.5;

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
  return notImplemented(`stepMovement ${String(k)}${String(intent)}${String(limits)}${dt}`);
}

/** Clamp x into [minX, maxX] (sidelines, §8.4). If clamped, zero the x velocity component. */
export function clampToSidelines(k: Kinematic, minX: number, maxX: number): Kinematic {
  return notImplemented(`clampToSidelines ${String(k)}${minX}${maxX}`);
}

/**
 * Push apart players of the same group closer than MIN_SEPARATION (D-10: teammates only).
 * Each overlapping pair moves half the overlap each, along the line between them (equal positions:
 * split along x by id order). Single pass in id order; deterministic. Returns new positions.
 */
export function separateTeammates(positions: Readonly<Record<ID, Point>>): Record<ID, Point> {
  return notImplemented(`separateTeammates ${Object.keys(positions).length}`);
}

/** Ball flight (SRS §8.8). Pure. */
import { notImplemented } from '@/domain/notImplemented';
import type { BallState, ID, Point, TuningParams } from '@/domain/types';
import type { Rng } from './types';

/** Flight time (s) from → to at tuning.ballSpeed. */
export function flightTime(from: Point, to: Point, tuning: TuningParams): number {
  return notImplemented(`flightTime ${from.x}${to.x}${String(tuning)}`);
}

/**
 * Throw error (§8.8): σ = (1 − accuracy) × inaccuracyK × distance yards; landing = aim + σ·(gx, gy)
 * with gx, gy = gaussian(rng) (two draws, x first).
 */
export function applyThrowError(
  from: Point,
  aim: Point,
  accuracy: number,
  tuning: TuningParams,
  rng: Rng,
): Point {
  return notImplemented(`applyThrowError ${from.x}${aim.x}${accuracy}${String(tuning)}${String(rng)}`);
}

/** Ball state at launch: inAir from → landing, tThrow = t, tLand = t + flightTime. */
export function launchBall(
  from: Point,
  landing: Point,
  t: number,
  targetId: ID,
  tuning: TuningParams,
): BallState {
  return notImplemented(`launchBall ${from.x}${landing.x}${t}${targetId}${String(tuning)}`);
}

/** Position of an inAir ball at time t (linear interpolation, clamped to [tThrow, tLand]). */
export function ballPosAt(ball: BallState, t: number): Point {
  return notImplemented(`ballPosAt ${ball.state}${t}`);
}

/**
 * Where to aim so the ball meets a receiver: fixed-point iteration (≤ 5 rounds, stop when the change
 * < 0.01 s) on tFlight = |posAt(tRelease + tFlight) − from| / ballSpeed. Returns the aim point and the
 * arrival time (absolute).
 */
export function leadTarget(
  from: Point,
  tRelease: number,
  posAt: (t: number) => Point,
  tuning: TuningParams,
): { aim: Point; tArrive: number } {
  return notImplemented(`leadTarget ${from.x}${tRelease}${String(posAt)}${String(tuning)}`);
}

/** Ball flight (SRS §8.8). Pure. */
import { distance, lerpPoint } from '@/domain/geometry';
import type { BallState, ID, Point, TuningParams } from '@/domain/types';
import { gaussian } from './rng';
import type { Rng } from './types';

/** Flight time (s) from → to at tuning.ballSpeed. */
export function flightTime(from: Point, to: Point, tuning: TuningParams): number {
  return distance(from, to) / tuning.ballSpeed;
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
  const sigma = (1 - accuracy) * tuning.inaccuracyK * distance(from, aim);
  const gx = gaussian(rng);
  const gy = gaussian(rng);
  return { x: aim.x + sigma * gx, y: aim.y + sigma * gy };
}

/** Ball state at launch: inAir from → landing, tThrow = t, tLand = t + flightTime. */
export function launchBall(
  from: Point,
  landing: Point,
  t: number,
  targetId: ID,
  tuning: TuningParams,
): BallState {
  return {
    state: 'inAir',
    pos: { ...from },
    from: { ...from },
    landing: { ...landing },
    tThrow: t,
    tLand: t + flightTime(from, landing, tuning),
    targetId,
  };
}

/** Position of an inAir ball at time t (linear interpolation, clamped to [tThrow, tLand]). */
export function ballPosAt(ball: BallState, t: number): Point {
  const { from, landing, tThrow, tLand } = ball;
  if (from === undefined || landing === undefined || tThrow === undefined || tLand === undefined) {
    return ball.pos;
  }
  const span = tLand - tThrow;
  if (span <= 0) return { ...(t < tThrow ? from : landing) };
  const u = Math.min(1, Math.max(0, (t - tThrow) / span));
  return lerpPoint(from, landing, u);
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
  let tFlight = flightTime(from, posAt(tRelease), tuning);
  for (let i = 0; i < 5; i++) {
    const next = flightTime(from, posAt(tRelease + tFlight), tuning);
    const change = Math.abs(next - tFlight);
    tFlight = next;
    if (change < 0.01) break;
  }
  return { aim: posAt(tRelease + tFlight), tArrive: tRelease + tFlight };
}

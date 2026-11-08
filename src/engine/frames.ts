/** Frame lookup for playback. Lead-owned. */
import { lerpPoint } from '@/domain/geometry';
import type { Frame, Point } from '@/domain/types';

/** Last frame with frame.t ≤ t (first frame when t is before it). undefined for an empty list. */
export function frameAt(frames: readonly Frame[], t: number): Frame | undefined {
  if (frames.length === 0) return undefined;
  let lo = 0;
  let hi = frames.length - 1;
  if (t <= frames[0]!.t) return frames[0];
  if (t >= frames[hi]!.t) return frames[hi];
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (frames[mid]!.t <= t) lo = mid;
    else hi = mid - 1;
  }
  return frames[lo];
}

/** Visual time (s) the snapped ball takes from the LOS to the QB (D-37). Drawing only: the sim is unchanged. */
export const SNAP_FLIGHT = 0.25;

/**
 * Where to draw the ball at playback time `t`. Held by the QB it sits on the LOS (the origin) until the snap, flies to
 * the QB over SNAP_FLIGHT and then stays with them; thrown or loose it is exactly where the engine put it.
 */
export function displayBallPos(frame: Frame, t: number, qbPos: Point | undefined): Point {
  if (frame.ball.state !== 'held') return frame.ball.pos;
  const target = qbPos ?? frame.ball.pos;
  if (t >= SNAP_FLIGHT) return target;
  const origin = { x: 0, y: 0 };
  return t <= 0 ? origin : lerpPoint(origin, target, t / SNAP_FLIGHT);
}

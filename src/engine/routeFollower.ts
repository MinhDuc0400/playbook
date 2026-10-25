/**
 * Kinematic route following for receivers (§8.5 receiver bullets 1–2, FR-ENG-05 part, D-13).
 * Shared by the offense-only preview (phase 1) and the receiver agent (phase 3). Pure.
 */
import { EPS, clamp, distance, length, normalize, sub, turnAngle } from '@/domain/geometry';
import type { ID, Point, RouteAction } from '@/domain/types';
import { DECEL_FACTOR, brakingSpeed } from './movement';
import type { Intent, Kinematic, MoveLimits } from './types';

/** Turn angle (degrees) at a non-smooth waypoint from which it counts as a sharp break (tell + 'break' event). */
export const SHARP_BREAK_DEG = 30;
/** Arrival radius at a waypoint (yd). */
export const ARRIVE_RADIUS = 0.3;
/** Smooth waypoints are rounded by turning toward the next segment within this distance (yd). */
export const SMOOTH_RADIUS = 1.5;
/** During the tell window the receiver's desired speed drops to this fraction of max speed. */
export const TELL_SPEED_FACTOR = 0.5;

export interface RoutePlan {
  slotId: ID;
  start: Point;
  waypoints: Point[]; // route.path (absolute, start excluded)
  smooth: boolean[];
  /** Indexes of waypoints that are sharp breaks (turn ≥ SHARP_BREAK_DEG and not smooth). Last point excluded. */
  sharpBreaks: number[];
  endBehavior: 'stop' | 'continue';
  delay: number; // s after snap
}

export interface FollowState {
  index: number; // current target waypoint
  done: boolean; // path finished
  heading: Point; // last segment direction (for 'continue')
}

export interface FollowResult {
  intent: Intent;
  state: FollowState;
  /** Set on the tick a sharp-break waypoint is reached (emit a 'break' event). */
  brokeAt?: number;
  /** True while inside the tell window before a sharp break (§8.5: decel = defense-readable tell). */
  telling: boolean;
}

/** Tolerance when deciding that a player stands on a sideline / the back line. */
const BOUND_EPS = 1e-6;

/** Waypoint pulled inside the playable area: movement is clamped to it, so that is as far as a player gets. */
function reachable(p: Point, bounds: { minX: number; maxX: number; maxY: number }): Point {
  return { x: clamp(p.x, bounds.minX, bounds.maxX), y: Math.min(p.y, bounds.maxY) };
}

/** Build a plan from a slot start and its route; null when the route has no points. */
export function planRoute(slotId: ID, start: Point, route: RouteAction): RoutePlan | null {
  if (route.path.length === 0) return null;
  const waypoints = route.path.map((p) => ({ x: p.x, y: p.y }));
  const smooth = waypoints.map((_, i) => route.smooth?.[i] === true);
  const sharpBreaks: number[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const prev = i === 0 ? start : (waypoints[i - 1] as Point);
    if (!smooth[i] && turnAngle(prev, waypoints[i] as Point, waypoints[i + 1] as Point) >= SHARP_BREAK_DEG) {
      sharpBreaks.push(i);
    }
  }
  return {
    slotId,
    start: { x: start.x, y: start.y },
    waypoints,
    smooth,
    sharpBreaks,
    endBehavior: route.endBehavior,
    delay: route.delay ?? 0,
  };
}

/** Direction of the segment that ends at waypoint `i` (start → wp0 for i = 0); `fallback` if degenerate. */
function segmentHeading(plan: RoutePlan, i: number, fallback: Point): Point {
  const from = i === 0 ? plan.start : (plan.waypoints[i - 1] as Point);
  const dir = normalize(sub(plan.waypoints[i] as Point, from));
  return dir.x === 0 && dir.y === 0 ? fallback : dir;
}

export function initialFollowState(plan: RoutePlan): FollowState {
  return { index: 0, done: false, heading: segmentHeading(plan, 0, { x: 0, y: 1 }) };
}

const STAND: Intent = { heading: { x: 0, y: 0 }, speed: 0 };

/**
 * Intent for one tick at time t (s since snap):
 * - t < delay → stand still (speed 0).
 * - Head to waypoints[index]; within ARRIVE_RADIUS (or when the next step would overshoot) advance index;
 *   reaching a sharp break returns brokeAt = index.
 * - Smooth waypoint: within SMOOTH_RADIUS, aim at the next waypoint instead (rounded corner, no 'break').
 * - Tell: if the next waypoint is a sharp break and timeToArrive = dist / max(current speed, 0.1) ≤
 *   limits.cutLoss × tellWindow → desired speed = TELL_SPEED_FACTOR × limits.speed, telling = true.
 * - After the last waypoint: 'stop' → speed 0; 'continue' → keep the last segment heading at full speed
 *   until x leaves [bounds.minX, bounds.maxX] or y > bounds.maxY, then speed 0 (done = true).
 */
export function followRoute(
  plan: RoutePlan,
  state: FollowState,
  self: Kinematic,
  limits: MoveLimits,
  t: number,
  tellWindow: number,
  bounds: { minX: number; maxX: number; maxY: number },
): FollowResult {
  if (state.done || t < plan.delay) {
    return { intent: { heading: { ...STAND.heading }, speed: 0 }, state, telling: false };
  }

  const n = plan.waypoints.length;
  let index = state.index;
  let heading = state.heading;
  let brokeAt: number | undefined;

  // Advance at most one waypoint per tick so a 'break' is reported exactly once.
  if (index < n) {
    const dist = distance(self.pos, reachable(plan.waypoints[index] as Point, bounds));
    const isLast = index === n - 1;
    const arrived =
      dist <= ARRIVE_RADIUS || (!isLast && plan.smooth[index] === true && dist <= SMOOTH_RADIUS);
    if (arrived) {
      if (plan.sharpBreaks.includes(index)) brokeAt = index;
      index += 1;
      if (index < n) heading = segmentHeading(plan, index, heading);
    }
  }

  let done = false;
  let intent: Intent;
  let telling = false;

  if (index >= n) {
    const lastHeading = segmentHeading(plan, n - 1, heading);
    heading = lastHeading;
    if (plan.endBehavior === 'stop') {
      done = true;
      intent = { heading: { x: 0, y: 0 }, speed: 0 };
    } else {
      // Sidelines clamp x on their own; for y, start braking early enough to stand on the back line.
      const brakeDist =
        limits.accel > 0 ? length(self.vel) ** 2 / (2 * ((DECEL_FACTOR * limits.speed) / limits.accel)) : 0;
      const outside =
        (self.pos.x <= bounds.minX + BOUND_EPS && lastHeading.x < 0) ||
        (self.pos.x >= bounds.maxX - BOUND_EPS && lastHeading.x > 0) ||
        (self.pos.y + brakeDist >= bounds.maxY - BOUND_EPS && lastHeading.y > 0);
      if (outside) {
        done = true;
        intent = { heading: { x: 0, y: 0 }, speed: 0 };
      } else {
        intent = { heading: lastHeading, speed: limits.speed };
      }
    }
  } else {
    const target = reachable(plan.waypoints[index] as Point, bounds);
    const toTarget = sub(target, self.pos);
    const dist = length(toTarget);
    let speed = limits.speed;
    if (plan.sharpBreaks.includes(index)) {
      const timeToArrive = dist / Math.max(length(self.vel), 0.1);
      if (timeToArrive <= limits.cutLoss * tellWindow) {
        speed = TELL_SPEED_FACTOR * limits.speed;
        telling = true;
      }
    } else if (index === n - 1 && plan.endBehavior === 'stop') {
      // Brake so the receiver stands on the final point instead of sliding past it.
      speed = Math.min(speed, brakingSpeed(dist, limits));
    }
    intent = { heading: dist < EPS ? heading : toTarget, speed };
  }

  const result: FollowResult = { intent, state: { index, done, heading }, telling };
  if (brokeAt !== undefined) result.brokeAt = brokeAt;
  return result;
}

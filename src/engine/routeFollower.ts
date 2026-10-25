/**
 * Kinematic route following for receivers (§8.5 receiver bullets 1–2, FR-ENG-05 part, D-13).
 * Shared by the offense-only preview (phase 1) and the receiver agent (phase 3). Pure.
 */
import { notImplemented } from '@/domain/notImplemented';
import type { ID, Point, RouteAction } from '@/domain/types';
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

/** Build a plan from a slot start and its route; null when the route has no points. */
export function planRoute(slotId: ID, start: Point, route: RouteAction): RoutePlan | null {
  return notImplemented(`planRoute ${slotId}${start.x}${route.type}`);
}

export function initialFollowState(plan: RoutePlan): FollowState {
  return notImplemented(`initialFollowState ${plan.slotId}`);
}

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
  return notImplemented(
    `followRoute ${plan.slotId}${String(state)}${String(self)}${String(limits)}${t}${tellWindow}${String(bounds)}`,
  );
}

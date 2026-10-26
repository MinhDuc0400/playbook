/**
 * Kinematic route following for receivers (§8.5 receiver bullets 1–2, FR-ENG-05 part, D-13).
 * Shared by the offense-only preview (phase 1) and the receiver agent (phase 3). Pure.
 */
import { EPS, clamp, distance, length, normalize, sub, turnAngle } from '@/domain/geometry';
import type { Action, ID, MotionAction, OptionRouteAction, Point, RouteAction } from '@/domain/types';
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

// ---------------------------------------------------------------------------------------------
// Pre-snap motion (SRS §8.2.5, D-08) and option routes (SRS §8.5 receiver, FR-ENG-09 part).
// ---------------------------------------------------------------------------------------------

/** Arrival radius at the last motion point (yd): the mover is done and stands. */
const MOTION_ARRIVE = 0.1;
/** Smallest "time left" (s) used to compute the catch-up speed of a late motion. */
const MOTION_MIN_TIME_LEFT = 0.05;
/** Same safety factor as movement.brakingSpeed, so the cruise speed matches the braking curve. */
const MOTION_BRAKE = 0.8;

export interface MotionPlan {
  slotId: ID;
  start: Point;
  path: Point[]; // absolute, start excluded
  duration: number; // s, > 0; the motion occupies t ∈ [−duration, 0]
  /** Last point of the path (alignment at the snap). */
  end: Point;
}

/** First usable MotionAction of an action list: non-empty path and duration > 0; otherwise null. */
export function planMotion(slotId: ID, start: Point, actions: readonly Action[]): MotionPlan | null {
  const m = actions.find((a): a is MotionAction => a.type === 'motion');
  if (!m || m.path.length === 0 || !(m.duration > 0)) return null;
  const path = m.path.map((p) => ({ x: p.x, y: p.y }));
  const end = path[path.length - 1] as Point;
  return {
    slotId,
    start: { x: start.x, y: start.y },
    path,
    duration: m.duration,
    end: { x: end.x, y: end.y },
  };
}

export interface MotionState {
  index: number;
  done: boolean;
}

export function initialMotionState(): MotionState {
  return { index: 0, done: false };
}

/**
 * Intent for one tick of the motion at time t (s, negative before the snap): stand until t = −duration,
 * then run the path at the speed that reaches the end exactly at t = 0 (remaining length / time left,
 * capped at limits.speed; a mover that cannot make it arrives late). Brakes onto the last point.
 */
export function followMotion(
  plan: MotionPlan,
  state: MotionState,
  self: Kinematic,
  limits: MoveLimits,
  t: number,
): { intent: Intent; state: MotionState } {
  if (state.done || t < -plan.duration - 1e-9) {
    return { intent: { heading: { x: 0, y: 0 }, speed: 0 }, state };
  }
  const n = plan.path.length;
  let index = state.index;
  const isLast = (i: number): boolean => i === n - 1;
  while (index < n) {
    const d = distance(self.pos, plan.path[index] as Point);
    if (d <= (isLast(index) ? MOTION_ARRIVE : ARRIVE_RADIUS)) index += 1;
    else break;
  }
  if (index >= n) return { intent: { heading: { x: 0, y: 0 }, speed: 0 }, state: { index, done: true } };

  const target = plan.path[index] as Point;
  const dist = distance(self.pos, target);
  let remaining = dist;
  for (let i = index; i < n - 1; i++) remaining += distance(plan.path[i] as Point, plan.path[i + 1] as Point);
  const timeLeft = Math.max(-t, MOTION_MIN_TIME_LEFT);
  // Cruise speed that covers `remaining` in the time left *including* the final braking to a stop:
  // v²/(2a) − v·T + L = 0 (smaller root); impossible → full speed.
  const decel = limits.accel > 0 ? MOTION_BRAKE * ((DECEL_FACTOR * limits.speed) / limits.accel) : Infinity;
  let needed: number;
  if (!Number.isFinite(decel)) needed = remaining / timeLeft;
  else {
    const disc = timeLeft * timeLeft - (2 * remaining) / decel;
    needed = disc >= 0 ? decel * (timeLeft - Math.sqrt(disc)) : limits.speed;
  }
  let speed = Math.min(limits.speed, needed);
  if (isLast(index)) speed = Math.min(speed, brakingSpeed(dist, limits));
  return { intent: { heading: sub(target, self.pos), speed }, state: { index, done: false } };
}

export type OptionBranch = 'man' | 'zone';

export interface OptionPlan {
  slotId: ID;
  start: Point;
  /** Null when the stem is empty (the decision is taken at once). */
  stem: RoutePlan | null;
  /** Branch plans start at the end of the stem (D-08); null when the branch has no points. */
  vsMan: RoutePlan | null;
  vsZone: RoutePlan | null;
}

/** Build the plans of an option route; `start` is the player's position at the snap (motion end). */
export function planOption(slotId: ID, start: Point, option: OptionRouteAction): OptionPlan {
  const stem = planRoute(slotId, start, { type: 'route', path: option.stem, endBehavior: 'continue' });
  const stemEnd = stem ? (stem.waypoints[stem.waypoints.length - 1] as Point) : start;
  const branch = (path: Point[]): RoutePlan | null =>
    planRoute(slotId, stemEnd, { type: 'route', path, endBehavior: 'continue' });
  return {
    slotId,
    start: { x: start.x, y: start.y },
    stem,
    vsMan: branch(option.vsMan),
    vsZone: branch(option.vsZone),
  };
}

export interface OptionState {
  /** Set once the receiver has decided. */
  branch?: OptionBranch;
  plan: RoutePlan | null;
  follow: FollowState | null;
}

export function initialOptionState(op: OptionPlan): OptionState {
  return { plan: op.stem, follow: op.stem ? initialFollowState(op.stem) : null };
}

export interface OptionResult {
  intent: Intent;
  state: OptionState;
  brokeAt?: number;
  telling: boolean;
  /** Set on the tick the receiver decides. */
  chose?: OptionBranch;
}

/**
 * Follow the stem; when it ends call `decide()` once, switch to that branch (starting at the end of the
 * stem) and keep following it with followRoute. Indexes in `brokeAt` are relative to the active plan.
 */
export function followOption(
  op: OptionPlan,
  state: OptionState,
  self: Kinematic,
  limits: MoveLimits,
  t: number,
  tellWindow: number,
  bounds: { minX: number; maxX: number; maxY: number },
  decide: () => OptionBranch,
): OptionResult {
  let st = state;
  let chose: OptionBranch | undefined;
  if (st.branch === undefined) {
    if (st.plan && st.follow) {
      const res = followRoute(st.plan, st.follow, self, limits, t, tellWindow, bounds);
      if (res.state.index < st.plan.waypoints.length) {
        const out: OptionResult = {
          intent: res.intent,
          state: { plan: st.plan, follow: res.state },
          telling: res.telling,
        };
        if (res.brokeAt !== undefined) out.brokeAt = res.brokeAt;
        return out;
      }
    }
    chose = decide();
    const plan = chose === 'man' ? op.vsMan : op.vsZone;
    st = { branch: chose, plan, follow: plan ? initialFollowState(plan) : null };
  }
  if (!st.plan || !st.follow) {
    return {
      intent: { heading: { x: 0, y: 0 }, speed: 0 },
      state: st,
      telling: false,
      ...(chose ? { chose } : {}),
    };
  }
  const res = followRoute(st.plan, st.follow, self, limits, t, tellWindow, bounds);
  const out: OptionResult = {
    intent: res.intent,
    state: { branch: st.branch as OptionBranch, plan: st.plan, follow: res.state },
    telling: res.telling,
  };
  if (res.brokeAt !== undefined) out.brokeAt = res.brokeAt;
  if (chose) out.chose = chose;
  return out;
}

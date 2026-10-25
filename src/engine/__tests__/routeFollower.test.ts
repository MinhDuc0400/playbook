import { describe, expect, it } from 'vitest';
import { buildRoute } from '@/domain/routeTree';
import type { Point, RouteAction } from '@/domain/types';
import { clampToSidelines, stepMovement } from '../movement';
import {
  ARRIVE_RADIUS,
  SHARP_BREAK_DEG,
  TELL_SPEED_FACTOR,
  followRoute,
  initialFollowState,
  planRoute,
  type FollowResult,
  type RoutePlan,
} from '../routeFollower';
import type { Kinematic, MoveLimits } from '../types';

const DT = 1 / 60;
const TELL_WINDOW = 0.25;
const LIMITS: MoveLimits = { speed: 7, accel: 0.9, cutLoss: 0.35 };
const BOUNDS = { minX: -15, maxX: 15, maxY: 60 };

interface Trace {
  t: number;
  kin: Kinematic;
  res: FollowResult;
}

function run(plan: RoutePlan, seconds: number, limits: MoveLimits = LIMITS): Trace[] {
  let kin: Kinematic = { pos: { ...plan.start }, vel: { x: 0, y: 0 } };
  let state = initialFollowState(plan);
  const out: Trace[] = [];
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    const t = i * DT;
    const res = followRoute(plan, state, kin, limits, t, TELL_WINDOW, BOUNDS);
    state = res.state;
    kin = clampToSidelines(stepMovement(kin, res.intent, limits, DT), BOUNDS.minX, BOUNDS.maxX);
    out.push({ t, kin, res });
  }
  return out;
}

const speedOf = (k: Kinematic): number => Math.hypot(k.vel.x, k.vel.y);
const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
const route = (path: Point[], over: Partial<RouteAction> = {}): RouteAction => ({
  type: 'route',
  path,
  endBehavior: 'stop',
  ...over,
});

describe('planRoute', () => {
  it('returns null for an empty path', () => {
    expect(planRoute('x', { x: 0, y: 0 }, route([]))).toBeNull();
  });

  it("marks index 0 of an 'out' as sharp and excludes the last point", () => {
    const start = { x: 10, y: 0 };
    const plan = planRoute('wr', start, buildRoute('out', start, { depth: 5 }))!;
    expect(plan.sharpBreaks).toEqual([0]);
    expect(plan.delay).toBe(0);
    expect(plan.endBehavior).toBe('continue');
    expect(plan.waypoints).toHaveLength(2);
  });

  it('does not mark smooth points or gentle turns as sharp', () => {
    const start = { x: 0, y: 0 };
    const smooth = planRoute(
      'a',
      start,
      route(
        [
          { x: 0, y: 5 },
          { x: 5, y: 5 },
        ],
        { smooth: [true, false] },
      ),
    )!;
    expect(smooth.sharpBreaks).toEqual([]);
    const gentle = planRoute(
      'b',
      start,
      route([
        { x: 0, y: 5 },
        { x: 1, y: 10 },
        { x: 1, y: 20 },
      ]),
    )!;
    expect(SHARP_BREAK_DEG).toBe(30);
    expect(gentle.sharpBreaks).toEqual([]); // turns of ~11° and ~11°
    const go = planRoute('c', start, buildRoute('go', start))!;
    expect(go.sharpBreaks).toEqual([]);
  });

  it('keeps delay, copies path and does not alias the route', () => {
    const r = route([{ x: 0, y: 5 }], { delay: 0.4 });
    const plan = planRoute('a', { x: 1, y: 2 }, r)!;
    expect(plan.delay).toBe(0.4);
    expect(plan.waypoints).toEqual([{ x: 0, y: 5 }]);
    expect(plan.waypoints[0]).not.toBe(r.path[0]);
    expect(plan.smooth).toEqual([false]);
  });
});

describe('followRoute (§8.5)', () => {
  it('stands still before delay, then runs', () => {
    const start = { x: 0, y: 0 };
    const plan = planRoute('a', start, route([{ x: 0, y: 20 }], { delay: 0.5, endBehavior: 'continue' }))!;
    const trace = run(plan, 1);
    for (const tr of trace.filter((x) => x.t < 0.5 - 1e-9)) {
      expect(speedOf(tr.kin)).toBe(0);
      expect(tr.kin.pos).toEqual(start);
    }
    expect(speedOf(trace[trace.length - 1]!.kin)).toBeGreaterThan(2);
  });

  it('follows a slant through both waypoints, in order', () => {
    const start = { x: 8, y: 0 };
    const r = buildRoute('slant', start);
    const plan = planRoute('wr', start, r)!;
    const trace = run(plan, 3.5);
    for (const wp of r.path) {
      expect(Math.min(...trace.map((tr) => dist(tr.kin.pos, wp)))).toBeLessThanOrEqual(ARRIVE_RADIUS + 0.05);
    }
    const first = trace.findIndex((tr) => dist(tr.kin.pos, r.path[0]!) <= ARRIVE_RADIUS);
    const second = trace.findIndex((tr) => dist(tr.kin.pos, r.path[1]!) <= ARRIVE_RADIUS);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(second).toBeGreaterThan(first);
  });

  it("'stop' ends standing near the last point", () => {
    const start = { x: 5, y: 0 };
    const r = buildRoute('hitch', start, { depth: 5 });
    const plan = planRoute('wr', start, r)!;
    const trace = run(plan, 4);
    const end = trace[trace.length - 1]!;
    expect(speedOf(end.kin)).toBe(0);
    expect(dist(end.kin.pos, r.path[1]!)).toBeLessThan(0.3);
    expect(end.res.state.done).toBe(true);
  });

  it("'continue' keeps the last heading until the sideline, then stops", () => {
    const start = { x: 8, y: 0 };
    const r = buildRoute('slant', start); // runs toward -x
    const plan = planRoute('wr', start, r)!;
    expect(plan.endBehavior).toBe('continue');
    const trace = run(plan, 6);
    const last = trace[trace.length - 1]!;
    expect(last.kin.pos.x).toBeCloseTo(BOUNDS.minX, 6);
    expect(speedOf(last.kin)).toBe(0);
    expect(last.res.state.done).toBe(true);
    // Heading preserved: direction of the last segment (-1, 1)/√2 while running past the last point.
    const past = trace.find((tr) => tr.kin.pos.y > r.path[1]!.y + 2 && !tr.res.state.done)!;
    expect(past.kin.vel.x / past.kin.vel.y).toBeCloseTo(-1, 6);
  });

  it("'continue' stops at the back of the end zone (maxY)", () => {
    const start = { x: 0, y: 40 };
    const plan = planRoute('wr', start, route([{ x: 0, y: 45 }], { endBehavior: 'continue' }))!;
    const trace = run(plan, 5);
    const last = trace[trace.length - 1]!;
    expect(last.kin.pos.y).toBeLessThanOrEqual(BOUNDS.maxY + 0.05);
    expect(last.res.state.done).toBe(true);
    expect(speedOf(last.kin)).toBe(0);
  });

  it('a waypoint beyond the sideline is reachable at the sideline (out route)', () => {
    const start = { x: 12, y: 0 };
    const r = buildRoute('out', start, { depth: 5 }); // ends at x = 20
    const plan = planRoute('wr', start, r)!;
    const trace = run(plan, 4);
    const last = trace[trace.length - 1]!;
    expect(last.kin.pos.x).toBeCloseTo(BOUNDS.maxX, 6);
    expect(speedOf(last.kin)).toBe(0);
    expect(last.res.state.done).toBe(true);
  });

  it('tells only inside cutLoss × tellWindow before a sharp break, at half speed', () => {
    const start = { x: 0, y: 0 };
    const plan = planRoute(
      'wr',
      start,
      route([
        { x: 0, y: 12 },
        { x: 8, y: 12 },
      ]),
    )!;
    expect(plan.sharpBreaks).toEqual([0]);
    const trace = run(plan, 3);
    const tells = trace.filter((tr) => tr.res.telling);
    expect(tells.length).toBeGreaterThan(0);
    const window = LIMITS.cutLoss * TELL_WINDOW;
    for (const tr of tells) {
      const d = dist(tr.kin.pos, plan.waypoints[0]!);
      // positions here are post-step; the decision used the position one tick earlier
      expect(d).toBeLessThanOrEqual(7 * window + 7 * DT + 1e-9);
      expect(tr.res.intent.speed).toBeCloseTo(TELL_SPEED_FACTOR * LIMITS.speed, 12);
    }
    const idx = trace.indexOf(tells[0]!);
    expect(trace.slice(0, idx).every((tr) => !tr.res.telling && tr.res.intent.speed === LIMITS.speed)).toBe(
      true,
    );
    // Contiguous, and the receiver is slower at the break than a no-tell runner would be.
    expect(tells.length).toBe(trace.lastIndexOf(tells[tells.length - 1]!) - idx + 1);
    const atBreak = trace.find((tr) => tr.res.brokeAt === 0)!;
    expect(speedOf(atBreak.kin)).toBeLessThan(LIMITS.speed - 0.5);
  });

  it('never tells on a go route (no sharp breaks) or a smooth corner', () => {
    const start = { x: 0, y: 0 };
    const go = planRoute('a', start, buildRoute('go', start))!;
    expect(run(go, 3).some((tr) => tr.res.telling)).toBe(false);
    const sm = planRoute(
      'b',
      start,
      route(
        [
          { x: 0, y: 6 },
          { x: 8, y: 6 },
        ],
        { smooth: [true, false] },
      ),
    )!;
    expect(run(sm, 3).some((tr) => tr.res.telling || tr.res.brokeAt !== undefined)).toBe(false);
  });

  it('emits brokeAt exactly once per sharp break, in order', () => {
    const start = { x: 0, y: 0 };
    const plan = planRoute('wr', start, buildRoute('sluggo', start))!;
    expect(plan.sharpBreaks).toEqual([0, 1]);
    const broke = run(plan, 5)
      .map((tr) => tr.res.brokeAt)
      .filter((b): b is number => b !== undefined);
    expect(broke).toEqual([0, 1]);
  });

  it('smooth corners are rounded: path never touches the smooth waypoint exactly yet reaches the end', () => {
    const start = { x: 0, y: 0 };
    const r = route(
      [
        { x: 0, y: 6 },
        { x: 8, y: 6 },
      ],
      { smooth: [true, false] },
    );
    const trace = run(planRoute('a', start, r)!, 4);
    const closest = Math.min(...trace.map((tr) => dist(tr.kin.pos, { x: 0, y: 6 })));
    expect(closest).toBeGreaterThan(0.3);
    expect(dist(trace[trace.length - 1]!.kin.pos, { x: 8, y: 6 })).toBeLessThan(0.3);
  });

  it('returns done state as standing intent', () => {
    const plan = planRoute('a', { x: 0, y: 0 }, route([{ x: 0, y: 3 }]))!;
    const res = followRoute(
      plan,
      { index: 1, done: true, heading: { x: 0, y: 1 } },
      { pos: { x: 0, y: 3 }, vel: { x: 0, y: 0 } },
      LIMITS,
      5,
      TELL_WINDOW,
      BOUNDS,
    );
    expect(res.intent.speed).toBe(0);
    expect(res.brokeAt).toBeUndefined();
  });

  it('is deterministic', () => {
    const start = { x: 8, y: 0 };
    const plan = planRoute('wr', start, buildRoute('curl', start))!;
    expect(run(plan, 4)).toEqual(run(plan, 4));
  });
});

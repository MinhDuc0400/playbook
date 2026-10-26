/** Offense-only animation for "Chạy thử" (FR-OFF-06, D-13). Pure, deterministic. */
import { DEFAULT_PRESETS } from '@/domain/presets';
import { distance, sub } from '@/domain/geometry';
import { fieldBounds, sidelineBounds } from '@/domain/field';
import type {
  BallSpot,
  FieldConfig,
  Frame,
  FramePlayer,
  ID,
  Play,
  PlayerSlot,
  Point,
  QbDropAction,
  SimEvent,
  Stats,
  TuningParams,
} from '@/domain/types';
import { brakingSpeed, clampToSidelines, separateTeammates, stepMovement } from './movement';
import {
  followMotion,
  followOption,
  followRoute,
  initialFollowState,
  initialMotionState,
  initialOptionState,
  planMotion,
  planOption,
  planRoute,
  type FollowState,
  type MotionPlan,
  type MotionState,
  type OptionPlan,
  type OptionState,
  type RoutePlan,
} from './routeFollower';
import type { Kinematic, MoveLimits } from './types';

export interface PreviewInput {
  play: Play; // offense
  field: FieldConfig;
  ballSpot: BallSpot;
  tuning: TuningParams;
  /** By slot id; missing slots use DEFAULT_PRESETS.avg. */
  stats?: Record<ID, Stats>;
  /** Seconds after the snap to simulate (default 4). */
  duration?: number;
}

export interface PreviewResult {
  /** 30 fps (t = k/30), from −(longest motion) (0 without motion) to duration inclusive. */
  frames: Frame[];
  /** 'motion' per motioning player at the first tick, 'snap' at 0, 'break' per sharp break reached (playerId). */
  events: SimEvent[];
  duration: number;
}

const FRAME_RATE = 30;
const DEFAULT_DURATION = 4;
/** QB backpedal speed as a fraction of max speed. */
const DROP_SPEED_FACTOR = 0.7;
/** The QB stands once this close to the drop spot (yd). */
const DROP_ARRIVE = 0.05;
const TIME_EPS = 1e-9;

type Driver =
  | { kind: 'idle' }
  | { kind: 'drop'; target: Point; done: boolean }
  | { kind: 'route'; plan: RoutePlan; follow: FollowState }
  | { kind: 'option'; plan: OptionPlan; state: OptionState };

interface Runner {
  id: ID;
  limits: MoveLimits;
  driver: Driver;
  kin: Kinematic;
  motion: MotionPlan | null;
  motionState: MotionState;
}

function makeDriver(slot: PlayerSlot, at: Point): Driver {
  const drop = slot.actions.find((a): a is QbDropAction => a.type === 'qbDrop');
  if (drop) return { kind: 'drop', target: { x: slot.start.x, y: slot.start.y - drop.depth }, done: false };
  for (const a of slot.actions) {
    if (a.type === 'option') {
      const plan = planOption(slot.id, at, a);
      return { kind: 'option', plan, state: initialOptionState(plan) };
    }
    if (a.type !== 'route') continue;
    const plan = planRoute(slot.id, at, a);
    if (plan) return { kind: 'route', plan, follow: initialFollowState(plan) };
    break;
  }
  return { kind: 'idle' };
}

/**
 * Step at tuning.simDt with stepMovement + clampToSidelines; record a frame every 1/30 s.
 * QB (first QbDropAction): backpedals straight to y = start.y − depth at 0.7 × speed, then stands; ball held
 * by QB (ball.state 'held', pos = QB pos, carrierId). Receivers follow their first RouteAction via
 * followRoute (state 'route'); slots without a route stand ('idle'). Frame player state strings:
 * 'drop' | 'route' | 'idle'. Teammates pushed apart with separateTeammates.
 * Pre-snap motion runs first: the sim clock starts at −(longest motion duration); each motioning player
 * moves along its path so it ends at t = 0, others stand; routes start from the motion end (D-08).
 * An option route has no defense to read in this offense-only run, so it always takes its `vsZone` branch.
 */
export function previewOffense(input: PreviewInput): PreviewResult {
  const { play, field, ballSpot, tuning } = input;
  const duration = input.duration ?? DEFAULT_DURATION;
  const dt = tuning.simDt;
  const sideline = sidelineBounds(field, ballSpot);
  const bounds = { minX: sideline.minX, maxX: sideline.maxX, maxY: fieldBounds(field, ballSpot).maxY };

  const runners: Runner[] = play.players.map((slot) => {
    const s = input.stats?.[slot.id] ?? DEFAULT_PRESETS.avg;
    const motion = planMotion(slot.id, slot.start, slot.actions);
    return {
      id: slot.id,
      limits: { speed: s.speed, accel: s.accel, cutLoss: s.cutLoss },
      driver: makeDriver(slot, motion ? motion.end : slot.start),
      kin: { pos: { x: slot.start.x, y: slot.start.y }, vel: { x: 0, y: 0 } },
      motion,
      motionState: initialMotionState(),
    };
  });
  const motionTime = runners.reduce((m, r) => Math.max(m, r.motion?.duration ?? 0), 0);
  const preTicks = Math.round(motionTime / dt);
  const firstFrame = 0 - Math.floor(preTicks * dt * FRAME_RATE + TIME_EPS);
  const carrierId = play.players.find((p) => p.role === 'QB')?.id;
  const events: SimEvent[] = [];
  for (const r of runners) {
    if (r.motion) {
      events.push({
        t: -preTicks * dt,
        type: 'motion',
        playerId: r.id,
        data: { duration: r.motion.duration },
      });
    }
  }
  events.push({ t: 0, type: 'snap' });

  const labels = new Map<ID, string>();
  const snapshot = (t: number): Frame => {
    const players: Record<ID, FramePlayer> = {};
    for (const r of runners) {
      players[r.id] = {
        pos: { x: r.kin.pos.x, y: r.kin.pos.y },
        vel: { x: r.kin.vel.x, y: r.kin.vel.y },
        state: labels.get(r.id) ?? r.driver.kind,
      };
    }
    const carrier = runners.find((r) => r.id === carrierId);
    const ball: Frame['ball'] =
      carrier === undefined
        ? { state: 'held', pos: { x: 0, y: 0 } }
        : { state: 'held', pos: { x: carrier.kin.pos.x, y: carrier.kin.pos.y }, carrierId: carrier.id };
    return { t, players, ball };
  };

  const totalFrames = Math.round(duration * FRAME_RATE);
  if (preTicks > 0) for (const r of runners) labels.set(r.id, 'idle');
  const frames: Frame[] = [snapshot(firstFrame / FRAME_RATE)];
  let nextFrame = firstFrame + 1;
  for (let tick = 0; nextFrame <= totalFrames; tick++) {
    const t = (tick - preTicks) * dt;
    for (const r of runners) {
      const d = r.driver;
      let next: Kinematic;
      labels.delete(r.id);
      if (t < 0) {
        if (r.motion && !r.motionState.done) {
          const res = followMotion(r.motion, r.motionState, r.kin, r.limits, t);
          r.motionState = res.state;
          if (t >= -r.motion.duration - 1e-9) labels.set(r.id, 'motion');
          next = stepMovement(r.kin, res.intent, r.limits, dt);
        } else {
          labels.set(r.id, 'idle');
          next = stepMovement(r.kin, { heading: { x: 0, y: 0 }, speed: 0 }, r.limits, dt);
        }
      } else if (d.kind === 'option') {
        const res = followOption(
          d.plan,
          d.state,
          r.kin,
          r.limits,
          t,
          tuning.tellWindow,
          bounds,
          () => 'zone',
        );
        d.state = res.state;
        labels.set(r.id, 'route');
        if (res.chose) events.push({ t, type: 'optionChoice', playerId: r.id, data: { branch: res.chose } });
        if (res.brokeAt !== undefined) {
          events.push({ t, type: 'break', playerId: r.id, data: { index: res.brokeAt } });
        }
        next = stepMovement(r.kin, res.intent, r.limits, dt);
      } else if (d.kind === 'route') {
        const res = followRoute(d.plan, d.follow, r.kin, r.limits, t, tuning.tellWindow, bounds);
        d.follow = res.state;
        if (res.brokeAt !== undefined) {
          events.push({ t, type: 'break', playerId: r.id, data: { index: res.brokeAt } });
        }
        next = stepMovement(r.kin, res.intent, r.limits, dt);
      } else if (d.kind === 'drop') {
        const toTarget = sub(d.target, r.kin.pos);
        const dist = distance(r.kin.pos, d.target);
        if (dist <= DROP_ARRIVE) d.done = true;
        const speed = d.done ? 0 : Math.min(DROP_SPEED_FACTOR * r.limits.speed, brakingSpeed(dist, r.limits));
        next = stepMovement(r.kin, { heading: d.done ? { x: 0, y: 0 } : toTarget, speed }, r.limits, dt);
      } else {
        next = stepMovement(r.kin, { heading: { x: 0, y: 0 }, speed: 0 }, r.limits, dt);
      }
      r.kin = clampToSidelines(next, bounds.minX, bounds.maxX);
    }

    const apart = separateTeammates(Object.fromEntries(runners.map((r) => [r.id, r.kin.pos])));
    for (const r of runners) {
      r.kin = clampToSidelines({ pos: apart[r.id] as Point, vel: r.kin.vel }, bounds.minX, bounds.maxX);
    }

    const time = (tick + 1 - preTicks) * dt;
    while (nextFrame <= totalFrames && nextFrame / FRAME_RATE <= time + TIME_EPS) {
      frames.push(snapshot(nextFrame / FRAME_RATE));
      nextFrame += 1;
    }
  }

  return { frames, events, duration };
}

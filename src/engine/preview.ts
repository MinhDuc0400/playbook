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
  followRoute,
  initialFollowState,
  planRoute,
  type FollowState,
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
  frames: Frame[]; // 30 fps, t from 0 to duration inclusive
  events: SimEvent[]; // 'snap' at 0, 'break' per sharp break reached (playerId)
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
  | { kind: 'route'; plan: RoutePlan; follow: FollowState };

interface Runner {
  id: ID;
  limits: MoveLimits;
  driver: Driver;
  kin: Kinematic;
}

function makeDriver(slot: PlayerSlot): Driver {
  const drop = slot.actions.find((a): a is QbDropAction => a.type === 'qbDrop');
  if (drop) return { kind: 'drop', target: { x: slot.start.x, y: slot.start.y - drop.depth }, done: false };
  for (const a of slot.actions) {
    if (a.type !== 'route') continue;
    const plan = planRoute(slot.id, slot.start, a);
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
 */
export function previewOffense(input: PreviewInput): PreviewResult {
  const { play, field, ballSpot, tuning } = input;
  const duration = input.duration ?? DEFAULT_DURATION;
  const dt = tuning.simDt;
  const sideline = sidelineBounds(field, ballSpot);
  const bounds = { minX: sideline.minX, maxX: sideline.maxX, maxY: fieldBounds(field, ballSpot).maxY };

  const runners: Runner[] = play.players.map((slot) => {
    const s = input.stats?.[slot.id] ?? DEFAULT_PRESETS.avg;
    return {
      id: slot.id,
      limits: { speed: s.speed, accel: s.accel, cutLoss: s.cutLoss },
      driver: makeDriver(slot),
      kin: { pos: { x: slot.start.x, y: slot.start.y }, vel: { x: 0, y: 0 } },
    };
  });
  const carrierId = play.players.find((p) => p.role === 'QB')?.id;
  const events: SimEvent[] = [{ t: 0, type: 'snap' }];

  const snapshot = (t: number): Frame => {
    const players: Record<ID, FramePlayer> = {};
    for (const r of runners) {
      players[r.id] = {
        pos: { x: r.kin.pos.x, y: r.kin.pos.y },
        vel: { x: r.kin.vel.x, y: r.kin.vel.y },
        state: r.driver.kind,
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
  const frames: Frame[] = [snapshot(0)];
  let nextFrame = 1;
  for (let tick = 0; nextFrame <= totalFrames; tick++) {
    const t = tick * dt;
    for (const r of runners) {
      const d = r.driver;
      let next: Kinematic;
      if (d.kind === 'route') {
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

    const time = (tick + 1) * dt;
    while (nextFrame <= totalFrames && nextFrame / FRAME_RATE <= time + TIME_EPS) {
      frames.push(snapshot(nextFrame / FRAME_RATE));
      nextFrame += 1;
    }
  }

  return { frames, events, duration };
}

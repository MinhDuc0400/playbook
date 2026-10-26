/** Receiver agent (SRS §8.5 receiver, FR-ENG-05, option route + motion). Own route only. */
import { distance, sub } from '@/domain/geometry';
import type { ID, Point } from '@/domain/types';
import {
  followMotion,
  followOption,
  followRoute,
  initialFollowState,
  initialMotionState,
  initialOptionState,
  type MotionPlan,
  type OptionBranch,
  type OptionPlan,
  type RoutePlan,
} from '../routeFollower';
import type { Agent, AgentIntent, AgentState, FieldInfo, PerceivedPlayer, Perception } from '../types';

/** Inside this distance (yd) of the landing point the receiver slows down proportionally. */
const BALL_ARRIVE_RADIUS = 0.5;
/** Option route: a defender must be this close (yd) at the stem end to be read as man (§8.5). */
export const OPTION_MAN_DISTANCE = 2;
/** Option route: minimum direction correlation with that defender over the window. */
export const OPTION_MAN_CORRELATION = 0.7;
/** Option route: length (s) of the correlation window. */
export const OPTION_WINDOW = 0.8;
/** Velocities below this speed (yd/s) have no meaningful direction. */
const MIN_DIRECTION_SPEED = 0.1;

interface Sample {
  t: number;
  pos: Point;
  vel: Point;
  others: PerceivedPlayer[];
}

/**
 * - Pre-snap (self.t < 0): follow the motion (if any) at constant speed so it ends at t = 0; otherwise stand
 *   ('idle'). The route starts from wherever the receiver is at the snap.
 * - Before the throw: followRoute(plan) (tell, breaks → 'break' events, endBehavior). No plan → stand ('idle').
 * - Option route (`option`): follow the stem; at its end decide from the delayed Perception — nearest
 *   perceived defender within 2 yd (measured from where the receiver was at the perceived time) and mean cosine(own velocity, its velocity) ≥ 0.7 over the last 0.8 s
 *   → 'man' (vsMan) else 'zone' (vsZone); emits an 'optionChoice' event { branch }.
 * - self.isBallTarget and perceived ball inAir with a landing → seek the landing point at full speed
 *   (state 'ball'); not the target → keep the route.
 * - Ball dead → decelerate to a stop.
 */
export function createReceiverAgent(opts: {
  id: ID;
  plan: RoutePlan | null;
  info: FieldInfo;
  motion?: MotionPlan | null;
  option?: OptionPlan | null;
}): Agent {
  const { plan, info } = opts;
  const motion = opts.motion ?? null;
  const option = opts.option ?? null;
  let follow = plan ? initialFollowState(plan) : null;
  let motionState = initialMotionState();
  let optionState = option ? initialOptionState(option) : null;
  const samples: Sample[] = [];
  const bounds = { minX: info.minX, maxX: info.maxX, maxY: info.maxY };

  /** Mean cosine between own velocity and the nearest defender's velocity over the window. */
  const decide = (self: AgentState, p: Perception): OptionBranch => {
    // The defenders are seen as of p.t: measure from where this receiver was then, not from where it is now.
    let ref: Point = self.pos;
    for (const s of samples) if (s.t <= p.t + 1e-9) ref = s.pos;
    let near: PerceivedPlayer | null = null;
    let best = Infinity;
    for (const o of p.others) {
      if (o.side !== 'defense') continue;
      const d = distance(o.pos, ref);
      if (d < best) {
        best = d;
        near = o;
      }
    }
    if (!near || best > OPTION_MAN_DISTANCE) return 'zone';
    let sum = 0;
    let n = 0;
    for (const s of samples) {
      if (s.t < self.t - OPTION_WINDOW - 1e-9) continue;
      const other = s.others.find((o) => o.id === (near as PerceivedPlayer).id);
      if (!other) continue;
      const a = Math.hypot(s.vel.x, s.vel.y);
      const b = Math.hypot(other.vel.x, other.vel.y);
      if (a < MIN_DIRECTION_SPEED || b < MIN_DIRECTION_SPEED) continue;
      sum += (s.vel.x * other.vel.x + s.vel.y * other.vel.y) / (a * b);
      n += 1;
    }
    return n > 0 && sum / n >= OPTION_MAN_CORRELATION ? 'man' : 'zone';
  };

  return {
    id: opts.id,
    step(self: AgentState, p: Perception): AgentIntent {
      const limits = { speed: self.stats.speed, accel: self.stats.accel, cutLoss: self.stats.cutLoss };
      if (self.t < 0) {
        if (motion && !motionState.done) {
          const res = followMotion(motion, motionState, self, limits, self.t);
          motionState = res.state;
          const moving = self.t >= -motion.duration - 1e-9;
          return { ...res.intent, state: moving ? 'motion' : 'idle' };
        }
        return { heading: { x: 0, y: 0 }, speed: 0, state: 'idle' };
      }
      if (p.ball.state === 'dead') {
        return { heading: { x: 0, y: 0 }, speed: 0, state: 'idle' };
      }
      if (self.isBallTarget && p.ball.state === 'inAir' && p.ball.landing) {
        const to: Point = sub(p.ball.landing, self.pos);
        const d = distance(p.ball.landing, self.pos);
        const speed = d < BALL_ARRIVE_RADIUS ? (self.stats.speed * d) / BALL_ARRIVE_RADIUS : self.stats.speed;
        return { heading: to, speed, state: 'ball' };
      }
      if (option && optionState) {
        if (optionState.branch === undefined) {
          samples.push({
            t: self.t,
            pos: { x: self.pos.x, y: self.pos.y },
            vel: { x: self.vel.x, y: self.vel.y },
            others: p.others,
          });
          while (samples.length > 0 && (samples[0] as Sample).t < self.t - OPTION_WINDOW - 1e-9)
            samples.shift();
        }
        const res = followOption(
          option,
          optionState,
          self,
          limits,
          self.t,
          info.tuning.tellWindow,
          bounds,
          () => decide(self, p),
        );
        optionState = res.state;
        const out: AgentIntent = { ...res.intent, state: 'route' };
        const events: NonNullable<AgentIntent['events']> = [];
        if (res.chose) events.push({ type: 'optionChoice', data: { branch: res.chose } });
        if (res.brokeAt !== undefined) events.push({ type: 'break' });
        if (events.length > 0) out.events = events;
        return out;
      }
      if (!plan || !follow) {
        return { heading: { x: 0, y: 0 }, speed: 0, state: 'idle' };
      }
      const res = followRoute(plan, follow, self, limits, self.t, info.tuning.tellWindow, bounds);
      follow = res.state;
      const out: AgentIntent = { ...res.intent, state: 'route' };
      if (res.brokeAt !== undefined) out.events = [{ type: 'break' }];
      return out;
    },
  };
}

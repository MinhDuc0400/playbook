/** Receiver agent (SRS §8.5 receiver, FR-ENG-05). Own route only. */
import { distance, sub } from '@/domain/geometry';
import type { ID, Point } from '@/domain/types';
import { followRoute, initialFollowState, type RoutePlan } from '../routeFollower';
import type { Agent, AgentIntent, AgentState, FieldInfo, Perception } from '../types';

/** Inside this distance (yd) of the landing point the receiver slows down proportionally. */
const BALL_ARRIVE_RADIUS = 0.5;

/**
 * - Before the throw: followRoute(plan) (tell, breaks → 'break' events, endBehavior). No plan → stand ('idle').
 * - self.isBallTarget and perceived ball inAir with a landing → seek the landing point at full speed
 *   (state 'ball'); not the target → keep the route.
 * - Ball dead → decelerate to a stop.
 */
export function createReceiverAgent(opts: { id: ID; plan: RoutePlan | null; info: FieldInfo }): Agent {
  const { plan, info } = opts;
  let follow = plan ? initialFollowState(plan) : null;
  const bounds = { minX: info.minX, maxX: info.maxX, maxY: info.maxY };

  return {
    id: opts.id,
    step(self: AgentState, p: Perception): AgentIntent {
      if (p.ball.state === 'dead') {
        return { heading: { x: 0, y: 0 }, speed: 0, state: 'idle' };
      }
      if (self.isBallTarget && p.ball.state === 'inAir' && p.ball.landing) {
        const to: Point = sub(p.ball.landing, self.pos);
        const d = distance(p.ball.landing, self.pos);
        const speed = d < BALL_ARRIVE_RADIUS ? (self.stats.speed * d) / BALL_ARRIVE_RADIUS : self.stats.speed;
        return { heading: to, speed, state: 'ball' };
      }
      if (!plan || !follow) {
        return { heading: { x: 0, y: 0 }, speed: 0, state: 'idle' };
      }
      const limits = { speed: self.stats.speed, accel: self.stats.accel, cutLoss: self.stats.cutLoss };
      const res = followRoute(plan, follow, self, limits, self.t, info.tuning.tellWindow, bounds);
      follow = res.state;
      const out: AgentIntent = { ...res.intent, state: 'route' };
      if (res.brokeAt !== undefined) out.events = [{ type: 'break' }];
      return out;
    },
  };
}

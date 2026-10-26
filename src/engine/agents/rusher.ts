/** Rusher agent (SRS §8.6 rush). */
import { distance, sub } from '@/domain/geometry';
import type { ID, Point } from '@/domain/types';
import type { Agent, AgentIntent, AgentState, FieldInfo, Perception } from '../types';

/** Waypoint arrival radius (yd). */
const ARRIVE_RADIUS = 0.5;

/**
 * Wait `delay` s, follow `path` waypoints (arrive radius 0.5 yd), then chase the QB position seen in the
 * perception (`p.qb.pos`) at full speed (state 'rush'). After the ball is out (perceived inAir/dead) →
 * pursue the ball landing point at full speed.
 */
export function createRusherAgent(opts: {
  id: ID;
  start: Point;
  path: Point[];
  delay: number;
  info: FieldInfo;
}): Agent {
  const { path, delay } = opts;
  let index = 0;

  return {
    id: opts.id,
    step(self: AgentState, p: Perception): AgentIntent {
      const stop: AgentIntent = { heading: { x: 0, y: 0 }, speed: 0, state: 'idle' };
      if (p.ball.state === 'dead') return stop;
      if (p.ball.state === 'inAir' && p.ball.landing) {
        return { heading: sub(p.ball.landing, self.pos), speed: self.stats.speed, state: 'ball' };
      }
      if (self.t < delay) return stop;
      while (index < path.length && distance(self.pos, path[index] as Point) <= ARRIVE_RADIUS) index += 1;
      const target = index < path.length ? (path[index] as Point) : p.qb.pos;
      return { heading: sub(target, self.pos), speed: self.stats.speed, state: 'rush' };
    },
  };
}

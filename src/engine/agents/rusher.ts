/** Rusher agent (SRS §8.6 rush). */
import { notImplemented } from '@/domain/notImplemented';
import type { ID, Point } from '@/domain/types';
import type { Agent, FieldInfo } from '../types';

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
  return notImplemented(`createRusherAgent ${opts.id}`);
}

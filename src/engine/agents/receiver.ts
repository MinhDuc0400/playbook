/** Receiver agent (SRS §8.5 receiver, FR-ENG-05). Own route only. */
import { notImplemented } from '@/domain/notImplemented';
import type { ID } from '@/domain/types';
import type { RoutePlan } from '../routeFollower';
import type { Agent, FieldInfo } from '../types';

/**
 * - Before the throw: followRoute(plan) (tell, breaks → 'break' events, endBehavior). No plan → stand ('idle').
 * - self.isBallTarget and perceived ball inAir with a landing → seek the landing point at full speed
 *   (state 'ball'); not the target → keep the route.
 * - Ball dead → decelerate to a stop.
 */
export function createReceiverAgent(opts: { id: ID; plan: RoutePlan | null; info: FieldInfo }): Agent {
  return notImplemented(`createReceiverAgent ${opts.id}`);
}

/** Zone defender (SRS §8.6 zone). */
import { notImplemented } from '@/domain/notImplemented';
import type { ID, Point } from '@/domain/types';
import type { Agent, FieldInfo } from '../types';

/**
 * - Phase 1: run to dropPoint (state 'zone').
 * - Phase 2 (dropPoint reached within 1 yd, or any offensive receiver seen inside polygon + zoneBuffer):
 *   among seen offensive non-QB players inside the polygon expanded by zoneBuffer (distanceToPolygon ≤
 *   zoneBuffer): deep zone → deepest (max y); shallow → closest to self. Aim = point on the segment
 *   receiver→QB(seen) at 1.5 yd from the receiver toward the QB, clamped to stay within polygon +
 *   zoneBuffer (if outside, project back to the closest point of the expanded zone ≈ move toward drop).
 *   No threat → drift toward dropPoint.
 * - Receiver leaves the zone (+buffer) → released (no carry in phase 3).
 * - QB eyes: aim.x += (eyeTarget seen x − aim.x) × iq × eyeDriftFactor when p.qb.eyeTarget is seen
 *   (§8.6; full anticipation gating comes in phase 5 — apply always in phase 3).
 * - Ball: as man defender (throwStarted → eyeTarget; inAir → landing).
 */
export function createZoneDefender(opts: {
  id: ID;
  polygon: Point[];
  dropPoint: Point;
  deep: boolean;
  info: FieldInfo;
}): Agent {
  return notImplemented(`createZoneDefender ${opts.id}`);
}

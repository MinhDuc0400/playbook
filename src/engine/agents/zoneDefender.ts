/** Zone defender (SRS §8.6 zone). */
import { closestPointOnSegment, distance, distanceToPolygon } from '@/domain/geometry';
import type { ID, Point } from '@/domain/types';
import type { Agent, AgentIntent, FieldInfo } from '../types';
import { ballResponse, findPerceived, reactiveAim, seek } from './common';

/** Distance from the receiver toward the QB at which the zone defender sits. */
const SHADOW_DIST = 1.5;
/** Reached-dropPoint radius that starts phase 2. */
const DROP_REACHED = 1;
const ARRIVE = 1;

function closestBoundaryPoint(p: Point, polygon: readonly Point[]): Point {
  let best = polygon[0] as Point;
  let bestD = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const r = closestPointOnSegment(p, polygon[i] as Point, polygon[(i + 1) % polygon.length] as Point);
    if (r.dist < bestD) {
      bestD = r.dist;
      best = r.point;
    }
  }
  return best;
}

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
  const { id, polygon, dropPoint, deep, info } = opts;
  const buffer = info.tuning.zoneBuffer;
  let phase2 = false;

  return {
    id,
    step(self, p): AgentIntent {
      const ball = ballResponse(self, p);
      if (ball) return ball;

      const maxSpeed = self.stats.speed;
      const threats = p.others
        .filter((o) => o.side === 'offense' && o.role !== 'QB' && distanceToPolygon(o.pos, polygon) <= buffer)
        .sort((a, b) => (a.id < b.id ? -1 : 1));

      if (!phase2 && (distance(self.pos, dropPoint) <= DROP_REACHED || threats.length > 0)) {
        phase2 = true;
      }
      if (!phase2) {
        return { ...seek(self.pos, dropPoint, maxSpeed, ARRIVE), state: 'zone' };
      }

      let aim: Point = { x: dropPoint.x, y: dropPoint.y };
      let chosen = threats[0];
      for (const t of threats) {
        if (!chosen) break;
        if (deep) {
          if (t.pos.y > chosen.pos.y) chosen = t;
        } else if (distance(t.pos, self.pos) < distance(chosen.pos, self.pos)) {
          chosen = t;
        }
      }
      if (chosen) {
        const rpos = reactiveAim(chosen, info.tuning.lookahead);
        const d = distance(rpos, p.qb.pos);
        aim =
          d > SHADOW_DIST
            ? {
                x: rpos.x + ((p.qb.pos.x - rpos.x) / d) * SHADOW_DIST,
                y: rpos.y + ((p.qb.pos.y - rpos.y) / d) * SHADOW_DIST,
              }
            : { x: p.qb.pos.x, y: p.qb.pos.y };
      }

      const eye = p.qb.eyeTarget !== undefined ? findPerceived(p, p.qb.eyeTarget) : undefined;
      if (eye) aim.x += (eye.pos.x - aim.x) * self.stats.iq * info.tuning.eyeDriftFactor;

      if (distanceToPolygon(aim, polygon) > buffer) aim = closestBoundaryPoint(aim, polygon);

      return { ...seek(self.pos, aim, maxSpeed, ARRIVE), state: 'zone' };
    },
  };
}

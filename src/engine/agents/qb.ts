/** QB agent (SRS §8.5 QB, D-15). Knows its own team's plan; never the defense play. */
import { distance } from '@/domain/geometry';
import { readTime } from '@/domain/stats';
import type { ID, Point, QbDropAction } from '@/domain/types';
import { leadTarget } from '../ball';
import { brakingSpeed } from '../movement';
import type { Agent, AgentIntent, FieldInfo, PerceivedPlayer, Perception } from '../types';

/** Assumed closing speed is not modelled: predicted defender position = seen pos + seen vel × Δt. */
export interface QbPlan {
  id: ID;
  start: Point;
  drop: QbDropAction | null;
  /** Read order (slot ids). Empty → all receivers sorted by id. */
  progression: ID[];
  /** Own receivers' planned positions (offense-only kinematic run, previewOffense). */
  plannedPos(receiverId: ID, t: number): Point | undefined;
}

/**
 * - Drop: backpedal to (start.x, start.y − depth) at 0.7 × speed (state 'drop'), then stand ('ball').
 *   QB never crosses the LOS (world also clamps).
 * - Reads start when the drop is done: each progression step lasts readTime(stats.iq) s (event 'read',
 *   targetId). eyeTarget = current read; per read step, with probability eyeDiscipline (one rng draw at
 *   the start of the step) look off: eyeTarget = another receiver (next one in progression, wrapping)
 *   for the first half of the step.
 * - Evaluate the current read every tick: tRelease = t + release; leadTarget(qbPos, tRelease, plannedPos)
 *   → aim, tArrive; valid if aim.y > 0 and |aim − qbPos| ≤ armRange; predicted separation = min over seen
 *   defenders of |aim − (def.pos + def.vel × (tArrive − p.t))|. Throw when valid and sep ≥
 *   throwOpenThreshold → intent.throw {targetId, aim}, event 'throwStart' is emitted by the world.
 * - Pressure: any seen defender with role 'R' within pressureRadius (event 'pressure' once), or
 *   t ≥ passClock − release → evaluate ALL receivers; best valid sep ≥ throwOpenThreshold → throw to it,
 *   else throwaway.
 * - After deciding: stand still.
 */
export function createQbAgent(opts: { plan: QbPlan; info: FieldInfo }): Agent {
  const { plan, info } = opts;
  const { tuning } = info;
  const dropDepth = plan.drop?.depth ?? 0;
  const dropTarget: Point = { x: plan.start.x, y: Math.min(0, plan.start.y - dropDepth) };
  const DROP_DONE_DIST = 0.05;
  const EPS_T = 1e-9;

  let dropDone = false;
  let decided = false;
  let pressureEmitted = false;
  let readIdx = -1;
  let stepStart = 0;
  let lookOff = false;
  let eyeTarget: ID | undefined;
  let progression: ID[] | null = null;

  const idle = (): AgentIntent => ({
    heading: { x: 0, y: 0 },
    speed: 0,
    state: 'ball',
    ...(eyeTarget !== undefined ? { eyeTarget } : {}),
  });

  /** Receivers to consider: progression, or all planned ids (sorted) when none given. */
  function receiverIds(others: PerceivedPlayer[]): ID[] {
    if (progression === null) {
      if (plan.progression.length > 0) progression = [...plan.progression];
      else {
        const ids = others
          .filter((o) => o.side === 'offense' && plan.plannedPos(o.id, 0) !== undefined)
          .map((o) => o.id);
        progression = [...new Set(ids)].sort();
      }
    }
    return progression;
  }

  /** Aim + validity + predicted separation for a receiver thrown to now. */
  function evaluate(
    id: ID,
    qbPos: Point,
    t: number,
    release: number,
    armRange: number,
    p: Perception,
  ): { aim: Point; sep: number } | null {
    const base = plan.plannedPos(id, 0);
    if (base === undefined) return null;
    const posAt = (tt: number): Point => plan.plannedPos(id, tt) ?? base;
    const { aim, tArrive } = leadTarget(qbPos, t + release, posAt, tuning);
    if (aim.y <= 0 || distance(aim, qbPos) > armRange) return null;
    let sep = Infinity;
    for (const d of p.others) {
      if (d.side !== 'defense') continue;
      const dt = tArrive - p.t;
      const pred = { x: d.pos.x + d.vel.x * dt, y: d.pos.y + d.vel.y * dt };
      sep = Math.min(sep, distance(aim, pred));
    }
    return { aim, sep };
  }

  return {
    id: plan.id,
    step(self, p, _dt, rng) {
      if (decided) return idle();
      const { release, armRange, eyeDiscipline, iq } = self.stats;
      const events: NonNullable<AgentIntent['events']> = [];
      const ids = receiverIds(p.others);

      // Pressure (perceived rushers) and pass clock force a decision at once.
      const pressured = p.others.some(
        (o) => o.side === 'defense' && o.role === 'R' && distance(o.pos, self.pos) <= tuning.pressureRadius,
      );
      if (pressured && !pressureEmitted) {
        pressureEmitted = true;
        events.push({ type: 'pressure', playerId: plan.id });
      }
      const clockOut = self.t >= info.field.passClock - release - EPS_T;
      if (pressured || clockOut) {
        decided = true;
        let best: { id: ID; aim: Point; sep: number } | null = null;
        for (const id of ids) {
          const ev = evaluate(id, self.pos, self.t, release, armRange, p);
          if (ev && ev.sep >= tuning.throwOpenThreshold && (best === null || ev.sep > best.sep)) {
            best = { id, ...ev };
          }
        }
        const out = idle();
        if (best) {
          eyeTarget = best.id;
          out.eyeTarget = eyeTarget;
          out.throw = { targetId: best.id, aim: best.aim };
        } else {
          out.throwaway = true;
        }
        if (events.length > 0) out.events = events;
        return out;
      }

      // Drop.
      if (!dropDone) {
        const d = distance(self.pos, dropTarget);
        if (d < DROP_DONE_DIST) dropDone = true;
        else {
          const limits = { speed: self.stats.speed, accel: self.stats.accel, cutLoss: self.stats.cutLoss };
          return {
            heading: { x: dropTarget.x - self.pos.x, y: dropTarget.y - self.pos.y },
            speed: Math.min(0.7 * self.stats.speed, brakingSpeed(d, limits)),
            state: 'drop',
            ...(events.length > 0 ? { events } : {}),
          };
        }
      }

      // Reads.
      if (ids.length === 0) {
        return { ...idle(), ...(events.length > 0 ? { events } : {}) };
      }
      const stepLen = readTime(iq);
      if (readIdx < 0 || self.t - stepStart >= stepLen - EPS_T) {
        readIdx = readIdx < 0 ? 0 : (readIdx + 1) % ids.length;
        stepStart = self.t;
        lookOff = rng() < eyeDiscipline;
        events.push({ type: 'read', playerId: plan.id, targetId: ids[readIdx] as ID });
      }
      const current = ids[readIdx] as ID;
      eyeTarget =
        lookOff && self.t - stepStart < stepLen / 2 ? (ids[(readIdx + 1) % ids.length] as ID) : current;

      const out: AgentIntent = {
        heading: { x: 0, y: 0 },
        speed: 0,
        state: 'ball',
        eyeTarget,
      };
      const ev = evaluate(current, self.pos, self.t, release, armRange, p);
      if (ev && ev.sep >= tuning.throwOpenThreshold) {
        decided = true;
        eyeTarget = current;
        out.eyeTarget = current;
        out.throw = { targetId: current, aim: ev.aim };
      }
      if (events.length > 0) out.events = events;
      return out;
    },
  };
}

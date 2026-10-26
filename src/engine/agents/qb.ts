/** QB agent (SRS §8.5 QB, D-15, D-22). Knows its own team's plan; never the defense play. */
import { distance } from '@/domain/geometry';
import { readTime } from '@/domain/stats';
import type { ID, LateralSide, Point, QbDropAction, ReadMetrics, ReadPlan, ReadWindow } from '@/domain/types';
import { leadTarget } from '../ball';
import { brakingSpeed } from '../movement';
import {
  buildWindows,
  laneRisk,
  minScoreFor,
  predictedSeparation,
  readOrder,
  readScore,
  type ReceiverInfo,
} from '../readModel';
import type { Agent, AgentIntent, FieldInfo, PerceivedPlayer, Perception } from '../types';

export interface QbPlan {
  id: ID;
  start: Point;
  drop: QbDropAction | null;
  /** Read order (slot ids) for mode 'progression'. Empty → left to right. */
  progression: ID[];
  /** Offense play's read customisation (D-22). Missing = progression mode with auto windows. */
  readPlan?: ReadPlan;
  /** Own receivers: alignment at the snap and planned first-break time. */
  receivers: ReceiverInfo[];
  strongSide: LateralSide;
  /** Estimated time (s after the snap) the drop ends; 0 without a drop. */
  dropEnd: number;
  /** Own receivers' planned positions (offense-only kinematic run, previewOffense). */
  plannedPos(receiverId: ID, t: number): Point | undefined;
  /** D-23: 'manual' = never decides on its own; throws only at `manualThrow`. Default 'auto'. */
  control?: 'auto' | 'manual';
  /** Manual mode: throw to `targetId` at the first tick with t ≥ `t` (ignored in auto mode). */
  manualThrow?: { targetId: ID; t: number };
}

export type QbDecision = ReadMetrics['decision'];

export interface QbAgent extends Agent {
  /** Read windows in read order (empty until the first step). */
  readonly windows: ReadWindow[];
  /** The decision once made, else null. */
  readonly decision: QbDecision | null;
}

interface Eval {
  id: ID;
  aim: Point;
  sep: number;
  score: number;
  valid: boolean;
}

/**
 * - Drop: backpedal to (start.x, start.y − depth) at 0.7 × speed (state 'drop'), then stand ('ball').
 * - Read windows (D-22): order = readOrder(mode, …), windows = buildWindows(…, readTime(iq)). The read is
 *   the window containing t; eyeTarget = that receiver (with probability eyeDiscipline — one rng draw per
 *   window — the first half of the window looks at the next read). Event 'read' when a window opens.
 * - Every tick after the drop, every receiver is scored: catch point = leadTarget(qbPos, t + release),
 *   valid if catch.y > 0 and |catch − qbPos| ≤ armRange, sep = predictedSeparation, risk = laneRisk,
 *   score = readScore; invalid → 0.
 * - Throw on the current read when valid && sep ≥ throwOpenThreshold && score ≥ minScoreFor(id). Mode 'best':
 *   from the first window's start, throw to the best valid receiver whose score reaches its minimum.
 * - After the last window, or once a rusher is within release + 0.5 s: check-down to the best valid receiver with score ≥ scoreThrow − 15.
 * - Pressure (seen rusher within pressureRadius, or reaching the QB within release + 0.25 s at
 *   assumedDefenderSpeed) or t ≥ passClock − release: best valid receiver with
 *   sep ≥ throwOpenThreshold ('forced'), else throwaway.
 * - After deciding: stand still.
 * - Manual control (D-23): drop and reads are unchanged, but none of the decisions above happen. At the
 *   first tick with t ≥ manualThrow.t (even during the drop) it throws to manualThrow.targetId (decision
 *   'manual'), or throws away when that target is unknown / behind the LOS / out of arm range.
 */
/** Yards the aim point stays inside the sidelines / end line (receivers are clamped there too). */
export const AIM_MARGIN = 1;

export function createQbAgent(opts: { plan: QbPlan; info: FieldInfo }): QbAgent {
  const { plan, info } = opts;
  const { tuning } = info;
  const dropDepth = plan.drop?.depth ?? 0;
  const dropTarget: Point = { x: plan.start.x, y: Math.min(0, plan.start.y - dropDepth) };
  const DROP_DONE_DIST = 0.05;
  const EPS_T = 1e-9;
  const CHECKDOWN_MARGIN = 15;
  const HURRY_MARGIN = 0.25;
  const CHECKDOWN_HURRY = 0.5;
  const mode = plan.readPlan?.mode ?? 'progression';
  const manual = plan.control === 'manual';
  const manualThrow = manual ? plan.manualThrow : undefined;

  let dropDone = false;
  let decided = false;
  let decision: QbDecision | null = null;
  let pressureEmitted = false;
  let windows: ReadWindow[] = [];
  let built = false;
  let lastWindow = -1;
  let lookOff = false;
  let eyeTarget: ID | undefined;
  const planned = new Map<ID, boolean>();
  for (const r of plan.receivers) planned.set(r.id, plan.plannedPos(r.id, 0) !== undefined);

  const idle = (): AgentIntent => ({
    heading: { x: 0, y: 0 },
    speed: 0,
    state: 'ball',
    ...(eyeTarget !== undefined ? { eyeTarget } : {}),
  });

  function evaluate(
    id: ID,
    qbPos: Point,
    t: number,
    release: number,
    armRange: number,
    p: Perception,
    defenders: readonly PerceivedPlayer[],
  ): Eval {
    const base = planned.get(id) ? plan.plannedPos(id, 0) : undefined;
    if (base === undefined) return { id, aim: qbPos, sep: 0, score: 0, valid: false };
    const posAt = (tt: number): Point => plan.plannedPos(id, tt) ?? base;
    const tRelease = t + release;
    const lead = leadTarget(qbPos, tRelease, posAt, tuning);
    const tArrive = lead.tArrive;
    // Throw to a catchable spot: at least AIM_MARGIN yd inside the sidelines and the end line.
    const aim: Point = {
      x: Math.min(info.maxX - AIM_MARGIN, Math.max(info.minX + AIM_MARGIN, lead.aim.x)),
      y: Math.min(info.maxY - AIM_MARGIN, lead.aim.y),
    };
    const sep = predictedSeparation({ catchPt: aim, tRelease, tArrive, pT: p.t, defenders, tuning });
    const valid = aim.y > 0 && distance(aim, qbPos) <= armRange;
    if (!valid) return { id, aim, sep, score: 0, valid };
    const dtR = tRelease - p.t;
    const atRelease = defenders.map((d) => ({ x: d.pos.x + d.vel.x * dtR, y: d.pos.y + d.vel.y * dtR }));
    const risk = laneRisk(qbPos, aim, atRelease, tuning.laneRadius);
    return { id, aim, sep, score: readScore(sep, aim.y, risk, tuning), valid };
  }

  const best = (evs: readonly Eval[], ok: (e: Eval) => boolean): Eval | null => {
    let out: Eval | null = null;
    for (const e of evs) if (e.valid && ok(e) && (out === null || e.score > out.score)) out = e;
    return out;
  };

  return {
    id: plan.id,
    get windows() {
      return windows;
    },
    get decision() {
      return decision;
    },
    step(self, p, _dt, rng) {
      if (decided) return idle();
      const { release, armRange, eyeDiscipline, iq } = self.stats;
      const t = self.t;
      if (!built) {
        built = true;
        const order = readOrder(mode, plan.progression, plan.receivers, plan.strongSide);
        windows = buildWindows({
          order,
          receivers: plan.receivers,
          plan: plan.readPlan,
          dropEnd: plan.dropEnd,
          readSec: readTime(iq),
          tuning,
        });
      }
      const events: NonNullable<AgentIntent['events']> = [];
      const defenders = p.others.filter((o) => o.side === 'defense');
      const evalAll = (): Eval[] =>
        plan.receivers.map((r) => evaluate(r.id, self.pos, t, release, armRange, p, defenders));

      const commit = (kind: QbDecision['kind'], e: Eval | null, readIndex: number | null): AgentIntent => {
        decided = true;
        const out = idle();
        if (e) {
          eyeTarget = e.id;
          out.eyeTarget = e.id;
          out.throw = { targetId: e.id, aim: e.aim };
          decision = { kind, t, targetId: e.id, score: e.score, readIndex };
        } else {
          out.throwaway = true;
          decision = { kind: 'throwaway', t, readIndex: null };
        }
        if (events.length > 0) out.events = events;
        return out;
      };

      // Pressure (perceived rushers) and the pass clock force a decision at once.
      // Anticipated pressure: seconds until the nearest perceived rusher reaches the QB.
      // The QB sees the rusher `lag` seconds late, so it is that much closer than perceived.
      const lag = Math.max(0, t - p.t);
      let tPress = Infinity;
      let pressured = false;
      for (const o of defenders) {
        if (o.role !== 'R') continue;
        const d = distance(o.pos, self.pos);
        if (d <= tuning.pressureRadius) pressured = true;
        tPress = Math.min(tPress, Math.max(0, d / tuning.assumedDefenderSpeed - lag));
      }
      if (tPress <= release + HURRY_MARGIN) pressured = true;
      if (pressured && !pressureEmitted) {
        pressureEmitted = true;
        events.push({ type: 'pressure', playerId: plan.id });
      }
      if (manualThrow !== undefined && t >= manualThrow.t - EPS_T) {
        const evs = evalAll();
        const scores: Record<ID, number> = {};
        for (const e of evs) scores[e.id] = e.score;
        const pick = evs.find((e) => e.id === manualThrow.targetId && e.valid) ?? null;
        const idx = pick ? windows.findIndex((w) => w.id === pick.id) : -1;
        const out = commit('manual', pick, idx >= 0 ? idx : null);
        out.qbDebug = { scores };
        return out;
      }
      if (!manual && (pressured || t >= info.field.passClock - release - EPS_T)) {
        const pick = best(evalAll(), (e) => e.sep >= tuning.throwOpenThreshold);
        return commit(pick ? 'forced' : 'throwaway', pick, null);
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
      const evs = evalAll();
      const scores: Record<ID, number> = {};
      for (const e of evs) scores[e.id] = e.score;
      const first = windows[0];
      const last = windows[windows.length - 1];
      if (first === undefined || last === undefined) {
        return { ...idle(), qbDebug: { scores }, ...(events.length > 0 ? { events } : {}) };
      }
      const cur = windows.find((w) => t >= w.from - EPS_T && t < w.to - EPS_T);
      if (cur !== undefined && cur.index !== lastWindow) {
        lastWindow = cur.index;
        lookOff = rng() < eyeDiscipline;
        events.push({ type: 'read', playerId: plan.id, targetId: cur.id });
      }
      if (cur !== undefined) {
        const next = windows[(cur.index + 1) % windows.length] as ReadWindow;
        eyeTarget = lookOff && t - cur.from < (cur.to - cur.from) / 2 ? next.id : cur.id;
      } else if (eyeTarget === undefined || t < first.from) {
        eyeTarget = first.id;
      }

      const byId = new Map(evs.map((e) => [e.id, e]));
      const indexOf = (id: ID): number => windows.findIndex((w) => w.id === id);
      const minOk = (e: Eval): boolean => e.score >= minScoreFor(e.id, plan.readPlan, tuning);
      let thrown: AgentIntent | null = null;
      if (manual) {
        // Manual control: hold and keep reading; the throw (if any) is handled above.
      } else if (mode === 'best') {
        if (t >= first.from - EPS_T) {
          const pick = best(evs, minOk);
          if (pick) thrown = commit('read', pick, indexOf(pick.id));
        }
      } else if (cur !== undefined) {
        const e = byId.get(cur.id);
        if (e && e.valid && e.sep >= tuning.throwOpenThreshold && minOk(e)) {
          thrown = commit('read', e, cur.index);
        }
      }
      if (!manual && thrown === null && (t >= last.to - EPS_T || tPress < release + CHECKDOWN_HURRY)) {
        const pick = best(evs, (e) => e.score >= tuning.scoreThrow - CHECKDOWN_MARGIN);
        if (pick) thrown = commit('checkdown', pick, null);
      }
      if (thrown) {
        thrown.qbDebug = { ...(cur ? { readId: cur.id } : {}), scores };
        return thrown;
      }

      const out: AgentIntent = {
        heading: { x: 0, y: 0 },
        speed: 0,
        state: 'ball',
        ...(eyeTarget !== undefined ? { eyeTarget } : {}),
        qbDebug: { ...(cur ? { readId: cur.id } : {}), scores },
      };
      if (events.length > 0) out.events = events;
      return out;
    },
  };
}

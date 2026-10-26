/**
 * QB read model (D-22): read order, read windows, closing-speed openness and read score. Pure.
 * Only uses the QB's own play knowledge and its (delayed) perception of defenders.
 */
import { clamp, closestPointOnSegment, distance } from '@/domain/geometry';
import type { ID, LateralSide, Point, ReadMode, ReadPlan, ReadWindow, TuningParams } from '@/domain/types';
import type { PerceivedPlayer } from './types';

export interface ReceiverInfo {
  id: ID;
  /** Alignment at the snap (after motion). */
  pos: Point;
  /** Planned time (s after snap) of the receiver's first sharp break; undefined = none (go, flat…). */
  breakTime?: number;
}

/**
 * Read order:
 * - 'progression' → `progression` filtered to known receivers (then any receiver not listed, by id);
 *   empty progression → all receivers sorted by x ascending (left → right).
 * - 'leftToRight' / 'rightToLeft' → by alignment x (ties by y desc = closer to LOS first, then id).
 * - 'strongToWeak' / 'weakToStrong' → strong side first: outside-in on the strong side (|x| desc), then
 *   outside-in on the weak side; receivers on the ball (|x| < 0.25) come after the strong side.
 * - 'best' → same as 'progression' (used only for eyes / window layout; decision picks the best score).
 */
export function readOrder(
  mode: ReadMode,
  progression: readonly ID[],
  receivers: readonly ReceiverInfo[],
  strongSide: LateralSide,
): ID[] {
  const byId = new Map(receivers.map((r) => [r.id, r]));
  const byX = (dir: 1 | -1) => (a: ReceiverInfo, b: ReceiverInfo) =>
    dir * (a.pos.x - b.pos.x) || b.pos.y - a.pos.y || a.id.localeCompare(b.id);
  const leftToRight = (): ID[] => [...receivers].sort(byX(1)).map((r) => r.id);

  if (mode === 'progression' || mode === 'best') {
    if (progression.length === 0) return leftToRight();
    const out: ID[] = [];
    const seen = new Set<ID>();
    for (const id of progression) {
      if (byId.has(id) && !seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
    const rest = receivers.filter((r) => !seen.has(r.id)).map((r) => r.id);
    return [...out, ...rest.sort((a, b) => a.localeCompare(b))];
  }
  if (mode === 'leftToRight') return leftToRight();
  if (mode === 'rightToLeft') return [...receivers].sort(byX(-1)).map((r) => r.id);

  const sign = strongSide === 'right' ? 1 : -1;
  const outsideIn = (a: ReceiverInfo, b: ReceiverInfo) =>
    Math.abs(b.pos.x) - Math.abs(a.pos.x) || b.pos.y - a.pos.y || a.id.localeCompare(b.id);
  const center = receivers.filter((r) => Math.abs(r.pos.x) < 0.25).sort(outsideIn);
  const strong = receivers.filter((r) => Math.abs(r.pos.x) >= 0.25 && r.pos.x * sign > 0).sort(outsideIn);
  const weak = receivers.filter((r) => Math.abs(r.pos.x) >= 0.25 && r.pos.x * sign < 0).sort(outsideIn);
  const ordered = mode === 'strongToWeak' ? [...strong, ...center, ...weak] : [...weak, ...center, ...strong];
  return ordered.map((r) => r.id);
}

/**
 * Windows in read order. Manual windows (plan.windows[id]) are used as given (clamped from ≥ dropEnd,
 * to > from). Auto window i: from = max(prevTo (or dropEnd for i = 0), (breakTime ?? dropEnd) −
 * readWindowLead), to = from + max(readWindowMin, readSec). Manual windows still advance `prevTo`.
 */
export function buildWindows(opts: {
  order: readonly ID[];
  receivers: readonly ReceiverInfo[];
  plan: ReadPlan | undefined;
  dropEnd: number;
  readSec: number; // readTime(iq)
  tuning: TuningParams;
}): ReadWindow[] {
  const { order, receivers, plan, dropEnd, readSec, tuning } = opts;
  const byId = new Map(receivers.map((r) => [r.id, r]));
  const out: ReadWindow[] = [];
  let prevTo = dropEnd;
  order.forEach((id, index) => {
    const manual = plan?.windows?.[id];
    if (manual !== undefined) {
      const from = Math.max(manual.from, dropEnd);
      const to = manual.to > from ? manual.to : from + tuning.readWindowMin;
      out.push({ id, index, from, to, auto: false });
      prevTo = to;
      return;
    }
    const brk = byId.get(id)?.breakTime ?? dropEnd;
    const from = Math.max(prevTo, brk - tuning.readWindowLead);
    const to = from + Math.max(tuning.readWindowMin, readSec);
    out.push({ id, index, from, to, auto: true });
    prevTo = to;
  });
  return out;
}

/**
 * Closing-speed openness: for each perceived defender, position at release = pos + vel × (tRelease − pT);
 * reach = assumedDefenderSpeed × max(0, (tArrive − tRelease) − assumedDefenderReaction);
 * sep_d = max(0, |defAtRelease − catchPt| − reach). Returns min over defenders (Infinity when none).
 */
export function predictedSeparation(opts: {
  catchPt: Point;
  tRelease: number;
  tArrive: number;
  pT: number; // perception time
  defenders: readonly PerceivedPlayer[];
  tuning: TuningParams;
}): number {
  const { catchPt, tRelease, tArrive, pT, defenders, tuning } = opts;
  const reach =
    tuning.assumedDefenderSpeed * Math.max(0, tArrive - tRelease - tuning.assumedDefenderReaction);
  let best = Infinity;
  for (const d of defenders) {
    const dt = tRelease - pT;
    const at = { x: d.pos.x + d.vel.x * dt, y: d.pos.y + d.vel.y * dt };
    best = Math.min(best, Math.max(0, distance(at, catchPt) - reach));
  }
  return best;
}

/**
 * INT risk 0..1: max over defenders (at release, as above) of max(0, 1 − d / laneRadius) where d = distance
 * from the defender to the segment from → catchPt, ignoring the last 1 yd before the catch point (that is
 * the contest, already in separation). laneRadius 0 → 0.
 */
export function laneRisk(
  from: Point,
  catchPt: Point,
  defendersAtRelease: readonly Point[],
  laneRadius: number,
): number {
  if (laneRadius <= 0) return 0;
  const len = distance(from, catchPt);
  if (len <= 1) return 0;
  // Segment from → catchPt minus the last 1 yd (the contest, already in separation).
  const end = {
    x: catchPt.x + ((from.x - catchPt.x) / len) * 1,
    y: catchPt.y + ((from.y - catchPt.y) / len) * 1,
  };
  let risk = 0;
  for (const d of defendersAtRelease) {
    const dist = closestPointOnSegment(d, from, end).dist;
    risk = Math.max(risk, 1 - dist / laneRadius);
  }
  return clamp(risk, 0, 1);
}

/**
 * Read score 0..100 = 100 × clamp((wScoreSep·open + wScoreGain·gain − wScoreRisk·risk) / (wScoreSep + wScoreGain), 0, 1)
 * with open = clamp(sep / scoreSepFull, 0, 1), gain = clamp(catchPt.y / scoreGainFull, 0, 1).
 */
export function readScore(sep: number, catchY: number, risk: number, tuning: TuningParams): number {
  const open = clamp(sep / tuning.scoreSepFull, 0, 1);
  const gain = clamp(catchY / tuning.scoreGainFull, 0, 1);
  const raw =
    (tuning.wScoreSep * open + tuning.wScoreGain * gain - tuning.wScoreRisk * risk) /
    (tuning.wScoreSep + tuning.wScoreGain);
  return 100 * clamp(raw, 0, 1);
}

/** Min score to throw on a receiver: plan.minScore?.[id] ?? tuning.scoreThrow. */
export function minScoreFor(id: ID, plan: ReadPlan | undefined, tuning: TuningParams): number {
  return plan?.minScore?.[id] ?? tuning.scoreThrow;
}

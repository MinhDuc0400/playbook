/**
 * "Ném lúc open nhất" (D-26, D-23): from a manual run without a throw, the throw time at which the ball
 * reaches the target when his separation is highest. Pure; reads the engine frames/metrics only.
 */
import { DEFAULT_PRESETS } from '@/domain/presets';
import type { ID, Point, SimInput, SimResult } from '@/domain/types';
import { frameAt } from '@/engine/frames';

const STILL_SPEED = 0.2;
const MARGIN = 0.05;
const ITERATIONS = 4;

const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Where and when a ball thrown at `t` reaches the target (fixed-point on the receiver's path). */
export function catchInfo(
  frames: SimResult['frames'],
  qbPos: Point,
  targetId: ID,
  t: number,
  release: number,
  ballSpeed: number,
): { ta: number; catchPoint: Point; distance: number } | null {
  let ta = t + release;
  let catchPoint = frameAt(frames, ta)?.players[targetId]?.pos;
  if (!catchPoint) return null;
  for (let i = 0; i < ITERATIONS; i++) {
    ta = t + release + dist(catchPoint, qbPos) / ballSpeed;
    const p = frameAt(frames, ta)?.players[targetId]?.pos;
    if (!p) return null;
    catchPoint = p;
  }
  return { ta, catchPoint, distance: dist(catchPoint, qbPos) };
}

/** Separation sample nearest in time to `t`. */
export function separationNear(
  series: { t: number; d: number }[] | undefined,
  t: number,
): number | undefined {
  let best: { t: number; d: number } | undefined;
  for (const e of series ?? []) if (!best || Math.abs(e.t - t) < Math.abs(best.t - t)) best = e;
  return best?.d;
}

export function bestThrowTime(args: {
  result: SimResult;
  input: SimInput;
  targetId: ID;
}): { t: number; separation: number } | null {
  const { result, input, targetId } = args;
  const frames = result.frames;
  const qbId = input.offense.players.find((p) => p.role === 'QB')?.id;
  const last = frames[frames.length - 1];
  if (qbId === undefined || !last) return null;
  const stats = input.offenseStats[qbId];
  const release = stats?.release ?? DEFAULT_PRESETS.avg.release;
  const armRange = stats?.armRange ?? DEFAULT_PRESETS.avg.armRange;
  const ballSpeed = input.tuning.ballSpeed;
  const series = result.metrics.separation[targetId];

  // First still frame after the drop (0 when the QB never moves).
  let dropEnd = 0;
  let moved = false;
  for (const f of frames) {
    if (f.t < 0) continue;
    const v = f.players[qbId]?.vel;
    const speed = v ? Math.hypot(v.x, v.y) : 0;
    if (speed >= STILL_SPEED) moved = true;
    else if (moved) {
      dropEnd = f.t;
      break;
    }
  }
  if (moved && dropEnd === 0) return null;
  const tMax = Math.min(last.t, input.field.passClock - release - MARGIN);
  const sackT = result.outcome.kind === 'sack' ? result.outcome.t : Infinity;

  let best: { t: number; separation: number } | null = null;
  for (const f of frames) {
    if (f.t < dropEnd - 1e-9 || f.t > tMax + 1e-9) continue;
    const qbPos = f.players[qbId]?.pos;
    if (!qbPos || sackT < f.t + release) continue;
    const c = catchInfo(frames, qbPos, targetId, f.t, release, ballSpeed);
    if (!c || c.catchPoint.y <= 0 || c.distance > armRange) continue;
    const sep = separationNear(series, c.ta);
    if (sep === undefined) continue;
    if (best === null || sep > best.separation) best = { t: f.t, separation: sep };
  }
  return best;
}

/** Separation metrics (SRS §8.1 SimMetrics, FR-ENG-07). Pure. */
import type { Frame, ID, SimMetrics } from '@/domain/types';

/**
 * From recorded frames:
 * - separation[r] = per frame { t, d } with d = min distance from receiver r to any defender (true positions).
 * - separationAtThrow[r] = separation of every receiver at tThrow (frame nearest to tThrow), when thrown.
 * - timeToThrow = tThrow (ball left the hand), when thrown.
 * - openWindows[r] = maximal [start, end] intervals with d ≥ separationOpen (consecutive frames).
 * Receivers = offense ids except the QB.
 */
export function computeMetrics(
  frames: readonly Frame[],
  receiverIds: readonly ID[],
  defenderIds: readonly ID[],
  tThrow: number | undefined,
  separationOpen: number,
): SimMetrics {
  const separation: SimMetrics['separation'] = {};
  const openWindows: SimMetrics['openWindows'] = {};

  for (const r of receiverIds) {
    const series: { t: number; d: number }[] = [];
    const windows: [number, number][] = [];
    let start: number | null = null;
    let last = 0;
    for (const f of frames) {
      const rp = f.players[r];
      if (!rp) continue;
      let d = Infinity;
      for (const did of defenderIds) {
        const dp = f.players[did];
        if (!dp) continue;
        const dd = Math.hypot(rp.pos.x - dp.pos.x, rp.pos.y - dp.pos.y);
        if (dd < d) d = dd;
      }
      series.push({ t: f.t, d });
      if (d >= separationOpen) {
        if (start === null) start = f.t;
        last = f.t;
      } else if (start !== null) {
        windows.push([start, last]);
        start = null;
      }
    }
    if (start !== null) windows.push([start, last]);
    separation[r] = series;
    openWindows[r] = windows;
  }

  const metrics: SimMetrics = { separation, openWindows };
  if (tThrow !== undefined) {
    metrics.timeToThrow = tThrow;
    const atThrow: Record<ID, number> = {};
    for (const r of receiverIds) {
      const series = separation[r] ?? [];
      let best: { t: number; d: number } | undefined;
      for (const s of series) {
        if (best === undefined || Math.abs(s.t - tThrow) < Math.abs(best.t - tThrow)) best = s;
      }
      if (best) atThrow[r] = best.d;
    }
    metrics.separationAtThrow = atThrow;
  }
  return metrics;
}

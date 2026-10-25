/** Separation metrics (SRS §8.1 SimMetrics, FR-ENG-07). Pure. */
import { notImplemented } from '@/domain/notImplemented';
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
  return notImplemented(
    `computeMetrics ${frames.length}${receiverIds.length}${defenderIds.length}${String(tThrow)}${separationOpen}`,
  );
}

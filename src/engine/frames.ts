/** Frame lookup for playback. Lead-owned. */
import type { Frame } from '@/domain/types';

/** Last frame with frame.t ≤ t (first frame when t is before it). undefined for an empty list. */
export function frameAt(frames: readonly Frame[], t: number): Frame | undefined {
  if (frames.length === 0) return undefined;
  let lo = 0;
  let hi = frames.length - 1;
  if (t <= frames[0]!.t) return frames[0];
  if (t >= frames[hi]!.t) return frames[hi];
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (frames[mid]!.t <= t) lo = mid;
    else hi = mid - 1;
  }
  return frames[lo];
}

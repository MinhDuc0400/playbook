/** "Tự căn" (FR-DEF-05): place defenders by target receiver + leverage + cushion. Pure. */
import { notImplemented } from '@/domain/notImplemented';
import type { AlignedPlayer } from '@/domain/numbering';
import type { ID, Play } from '@/domain/types';

/** Lateral offset (yd) toward the leverage side. */
export const ALIGN_LEVERAGE_OFFSET = 1;
/** Depth (yd) off the receiver for trail technique. */
export const TRAIL_DEPTH = 1;
/** Default cushion (yd) when a cushion man action has none. */
export const DEFAULT_CUSHION = 5;

/**
 * For each man defender (all, or only `slotIds`): bind its target against the ghost
 * (numberReceivers(ghost) + resolveReceiverRef); if found, start = {
 *   x: target.x + offset, with s = sign(target.x) (0 when |target.x| < 0.25):
 *      'inside' → −s × ALIGN_LEVERAGE_OFFSET (toward the ball), 'outside' → +s × ALIGN_LEVERAGE_OFFSET,
 *      'head-up' / no leverage → 0,
 *   y: max(0.5, target.y + depth) with depth = cushion (technique 'cushion', default DEFAULT_CUSHION)
 *      or TRAIL_DEPTH (trail) }.
 * Zone defenders and rushers are untouched. Unresolvable targets are skipped. Returns the same object
 * when nothing moved.
 */
export function autoAlign(play: Play, ghost: readonly AlignedPlayer[], slotIds?: readonly ID[]): Play {
  return notImplemented(`autoAlign ${play.id}${ghost.length}${String(slotIds)}`);
}

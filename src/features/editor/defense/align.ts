/** "Tự căn" (FR-DEF-05): place defenders by target receiver + leverage + cushion. Pure. */
import type { AlignedPlayer } from '@/domain/numbering';
import { numberReceivers, resolveReceiverRef } from '@/domain/numbering';
import type { ID, Leverage, Play, PlayerSlot } from '@/domain/types';

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
  const numbering = numberReceivers(ghost);
  const only = slotIds ? new Set(slotIds) : null;
  let changed = false;
  const players = play.players.map((slot): PlayerSlot => {
    if (only && !only.has(slot.id)) return slot;
    const man = slot.actions.find((a) => a.type === 'man');
    if (man?.type !== 'man') return slot;
    const targetId = resolveReceiverRef(man.target, numbering);
    const target = ghost.find((g) => g.id === targetId);
    if (!target) return slot;
    const start = {
      x: target.pos.x + lateralOffset(target.pos.x, slot.leverage),
      y: Math.max(0.5, target.pos.y + depthOff(man)),
    };
    if (start.x === slot.start.x && start.y === slot.start.y) return slot;
    changed = true;
    return { ...slot, start };
  });
  return changed ? { ...play, players } : play;
}

function lateralOffset(targetX: number, leverage: Leverage | undefined): number {
  const s = Math.abs(targetX) < 0.25 ? 0 : Math.sign(targetX);
  if (leverage === 'inside') return -s * ALIGN_LEVERAGE_OFFSET;
  if (leverage === 'outside') return s * ALIGN_LEVERAGE_OFFSET;
  return 0;
}

function depthOff(man: { technique: 'trail' | 'cushion'; cushion?: number }): number {
  return man.technique === 'cushion' ? (man.cushion ?? DEFAULT_CUSHION) : TRAIL_DEPTH;
}

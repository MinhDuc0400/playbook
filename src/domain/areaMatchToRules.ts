/**
 * D-48: convert the old Bunch Killer `areaMatch` slots of a play to area rules. Pure. Reads the raw
 * `areaMatch` key, so it also works on records stored before the field was removed.
 * - corner → the corner rule; its zone action is removed (the old corner ignored everyone whatever its zone).
 * - inside → the inside rule on its old outside corner (left neighbour corner first, else right, else none);
 *   with no zone action it gets the live lane zone (D-51).
 * - old custom rules on an area slot (the engine ignored them) are dropped; `areaMatch` (and `squeezeAfter`)
 *   is removed from every slot; one note line is appended.
 * Returns the same object when no slot has `areaMatch`.
 */
import { computeLanes } from './areaLanes';
import { canCover, cornerRules, insideRules } from './areaRules';
import type { ID, Play, PlayerSlot } from './types';

export const CONVERTED_NOTE = 'Đã chuyển Bunch Killer sang luật pattern match (D-48).';

type Role = 'corner' | 'inside';

function oldRole(slot: PlayerSlot): Role | null {
  const am = (slot as { areaMatch?: { role?: unknown } }).areaMatch;
  return am && (am.role === 'corner' || am.role === 'inside') ? am.role : null;
}

function hasAreaKey(slot: PlayerSlot): boolean {
  return 'areaMatch' in slot;
}

function withoutAreaKey(slot: PlayerSlot): PlayerSlot {
  const copy = { ...slot } as PlayerSlot & { areaMatch?: unknown };
  delete copy.areaMatch;
  return copy;
}

export function areaMatchToRules(play: Play): Play {
  if (!play.players.some(hasAreaKey)) return play;
  const active = new Set(play.players.filter((s) => oldRole(s) !== null && canCover(s)).map((s) => s.id));
  const lanes = computeLanes(play.players, (s) => active.has(s.id));
  const roleOf = new Map(play.players.map((s) => [s.id, oldRole(s)]));
  const outside = (id: ID): ID | null => {
    if (!lanes) return null;
    const i = lanes.order.indexOf(id);
    const left = lanes.order[i - 1];
    const right = lanes.order[i + 1];
    if (left !== undefined && roleOf.get(left) === 'corner') return left;
    if (right !== undefined && roleOf.get(right) === 'corner') return right;
    return null;
  };

  const ruled = play.players.map((slot): PlayerSlot => {
    const base = withoutAreaKey(slot);
    if (!active.has(slot.id)) return base;
    const id = () => `${slot.id}-bk`;
    if (roleOf.get(slot.id) === 'corner') {
      return { ...base, actions: base.actions.filter((a) => a.type !== 'zone'), matchRules: cornerRules(id) };
    }
    return { ...base, matchRules: insideRules(id, outside(slot.id)) };
  });

  // Insides without a zone keep zoning their lane (lanes from the converted slots = the same members).
  const players = ruled.map((slot): PlayerSlot => {
    if (
      !active.has(slot.id) ||
      roleOf.get(slot.id) !== 'inside' ||
      slot.actions.some((a) => a.type === 'zone')
    ) {
      return slot;
    }
    const dropPoint = { x: slot.start.x, y: slot.start.y };
    return { ...slot, actions: [...slot.actions, { type: 'zone', zone: 'lane', dropPoint }] };
  });

  return {
    ...play,
    players,
    notes: play.notes ? `${play.notes}\n${CONVERTED_NOTE}` : CONVERTED_NOTE,
  };
}

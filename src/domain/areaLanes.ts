/** Lanes from the defense's own alignment (D-40, D-48). Pure. */
import type { ID, PlayerSlot } from './types';

/** Vertical lanes from the alignment of some defenders (D-40, D-48). */
export interface Lanes {
  /** Member slot ids, left → right by start.x. Lane i belongs to order[i]. */
  order: ID[];
  /** order.length − 1 x boundaries (midpoints of neighbours), ascending. */
  boundaries: number[];
}

/** Lanes of the slots `isMember` accepts, ordered by start x (ties by id); null when there are none. */
export function computeLanes(
  slots: readonly PlayerSlot[],
  isMember: (s: PlayerSlot) => boolean,
): Lanes | null {
  const members = slots.filter(isMember).sort((a, b) => a.start.x - b.start.x || (a.id < b.id ? -1 : 1));
  if (members.length === 0) return null;
  const boundaries: number[] = [];
  for (let i = 0; i + 1 < members.length; i++) {
    boundaries.push((members[i]!.start.x + members[i + 1]!.start.x) / 2);
  }
  return { order: members.map((s) => s.id), boundaries };
}

/** Lane index containing x (a point on a boundary belongs to the lane on its right). */
export function laneOf(lanes: Lanes, x: number): number {
  let i = 0;
  while (i < lanes.boundaries.length && x >= lanes.boundaries[i]!) i += 1;
  return i;
}

/** [left, right] x of lane i; the outer lanes run to the given sideline bounds. */
export function laneSpan(lanes: Lanes, i: number, minX: number, maxX: number): [number, number] {
  const left = i === 0 ? minX : lanes.boundaries[i - 1]!;
  const right = i === lanes.boundaries.length ? maxX : lanes.boundaries[i]!;
  return [left, right];
}

/** Area-match lanes from the defense's own alignment (D-40). Pure. */
import type { ID, PlayerSlot } from './types';

export interface AreaLanes {
  /** Area-match slot ids, left → right by start.x. Lane i belongs to order[i]. */
  order: ID[];
  /** order.length − 1 x boundaries (midpoints of neighbours), ascending. */
  boundaries: number[];
  roles: ('corner' | 'inside')[];
  /** Per lane: the outside (corner) lane of an inside defender — left neighbour first; null otherwise. */
  outside: (number | null)[];
}

/** Lanes of the slots that have `areaMatch`; null when there are none. */
export function computeAreaLanes(slots: readonly PlayerSlot[]): AreaLanes | null {
  const area = slots
    .filter((s) => s.areaMatch !== undefined)
    .sort((a, b) => a.start.x - b.start.x || (a.id < b.id ? -1 : 1));
  if (area.length === 0) return null;
  const roles = area.map((s) => s.areaMatch!.role);
  const boundaries: number[] = [];
  for (let i = 0; i + 1 < area.length; i++) {
    boundaries.push((area[i]!.start.x + area[i + 1]!.start.x) / 2);
  }
  const outside = roles.map((role, i) => {
    if (role !== 'inside') return null;
    if (roles[i - 1] === 'corner') return i - 1;
    if (roles[i + 1] === 'corner') return i + 1;
    return null;
  });
  return { order: area.map((s) => s.id), boundaries, roles, outside };
}

/** Lane index containing x (a point on a boundary belongs to the lane on its right). */
export function laneOf(lanes: AreaLanes, x: number): number {
  let i = 0;
  while (i < lanes.boundaries.length && x >= lanes.boundaries[i]!) i += 1;
  return i;
}

/** [left, right] x of lane i; the outer lanes run to the given sideline bounds. */
export function laneSpan(lanes: AreaLanes, i: number, minX: number, maxX: number): [number, number] {
  const left = i === 0 ? minX : lanes.boundaries[i - 1]!;
  const right = i === lanes.boundaries.length ? maxX : lanes.boundaries[i]!;
  return [left, right];
}

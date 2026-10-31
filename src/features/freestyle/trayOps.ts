/** Pure ops for the Freestyle player tray and blank board (FR-FS-16, D-27). */
import { createPlay } from '@/domain/formations';
import type { Format, ID, Play, Point, Role, Side } from '@/domain/types';
import { addPlayer, type Recipe } from '@/features/editor/ops';

export const TRAY_ROLES: Record<Side, readonly Role[]> = {
  offense: ['QB', 'C', 'WR', 'RB', 'TE'],
  defense: ['CB', 'S', 'LB', 'R'],
};

/** Per-role caps (a single QB and a single C on the field); other roles are limited by maxPlayers only. */
const ROLE_CAP: Partial<Record<Role, number>> = { QB: 1, C: 1 };

/** How many more of each tray role can still be placed (never negative). */
export function remaining(play: Play, side: Side, maxPlayers: number): Record<Role, number> {
  const room = Math.max(0, maxPlayers - play.players.length);
  const out = {} as Record<Role, number>;
  for (const role of TRAY_ROLES[side]) {
    const used = play.players.filter((p) => p.role === role).length;
    const cap = ROLE_CAP[role];
    out[role] = Math.max(0, Math.min(room, cap === undefined ? room : cap - used));
  }
  return out;
}

/** Recipe adding `role` at `point`; no-op when the role is exhausted or the side is full. */
export function placeRole(role: Role, point: Point, maxPlayers: number, idGen: () => ID): Recipe {
  return (play) => {
    if (!TRAY_ROLES[play.side].includes(role)) return play;
    if ((remaining(play, play.side, maxPlayers)[role] ?? 0) <= 0) return play;
    return addPlayer(role, point, maxPlayers, idGen)(play);
  };
}

/** Blank board for one side: no players, named 'Freestyle'. */
export function emptyPlay(
  side: Side,
  format: Format = '5v5',
  now: number = Date.now(),
  idGen?: () => ID,
): Play {
  let n = 0;
  const gen = idGen ?? ((): ID => `fs-${now}-${++n}`);
  return { ...createPlay({ side, format, formationId: null, now, idGen: gen }), name: 'Freestyle' };
}

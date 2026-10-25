/** Ghost offense for the defense editor (FR-DEF-01). Lead-owned helper shared by phase 2 tasks. */
import { defaultGhostFormation, getFormation } from '@/domain/formations';
import { numberReceivers, type AlignedPlayer, type Numbering } from '@/domain/numbering';
import type { Format } from '@/domain/types';

/** Ghost player id for a formation label (also used by WarningsPanel). */
export function ghostId(label: string): string {
  return `ghost-${label}`;
}

/** Ghost formation preset in use: the chosen id when it exists for this format, else the default. */
export function ghostFormation(format: Format, ghostFormationId: string | null) {
  const chosen = ghostFormationId ? getFormation(ghostFormationId) : undefined;
  return chosen && chosen.side === 'offense' ? chosen : defaultGhostFormation(format);
}

/** Ghost players as aligned players (ids from ghostId). */
export function ghostPlayers(format: Format, ghostFormationId: string | null): AlignedPlayer[] {
  return ghostFormation(format, ghostFormationId).players.map((p) => ({
    id: ghostId(p.label),
    role: p.role,
    pos: { ...p.start },
  }));
}

/** Numbering of the ghost (computed strength). */
export function ghostNumbering(format: Format, ghostFormationId: string | null): Numbering {
  return numberReceivers(ghostPlayers(format, ghostFormationId));
}

/** Freestyle draft persistence in localStorage (FR-FS-09, D-27). Every access is guarded. */
import type { Play, Side } from '@/domain/types';
import { PlaySchema } from '@/lib/io/schemas';

export const DRAFT_KEY = 'flagbook.freestyle.v1';

export interface Draft {
  v: 1;
  offense: Play;
  defense: Play;
  activeSide: Side;
}

/** Stored draft, or null when absent, unreadable or invalid in any way. */
export function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw === null) return null;
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    const d = data as Record<string, unknown>;
    if (d.v !== 1) return null;
    if (d.activeSide !== 'offense' && d.activeSide !== 'defense') return null;
    const offense = PlaySchema.safeParse(d.offense);
    const defense = PlaySchema.safeParse(d.defense);
    if (!offense.success || !defense.success) return null;
    if (offense.data.side !== 'offense' || defense.data.side !== 'defense') return null;
    return { v: 1, offense: offense.data, defense: defense.data, activeSide: d.activeSide };
  } catch {
    return null;
  }
}

/** Best-effort write; returns false when storage is unavailable or full. */
export function saveDraft(draft: Draft): boolean {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // storage unavailable: nothing to clear
  }
}

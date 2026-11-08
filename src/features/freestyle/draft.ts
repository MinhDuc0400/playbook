/** Freestyle draft persistence in localStorage (FR-FS-09, D-27). Every access is guarded. */
import { areaMatchToRules } from '@/domain/areaMatchToRules';
import { createDefaultFields } from '@/domain/field';
import type { BallSpot, Play, Side } from '@/domain/types';
import { PlaySchema } from '@/lib/io/schemas';

/** D-48: drafts saved before area rules carry `areaMatch`; convert before validating. */
function converted(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null || !Array.isArray((raw as Play).players)) return raw;
  return areaMatchToRules(raw as Play, createDefaultFields()['5v5']);
}

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
    const offense = PlaySchema.safeParse(converted(d.offense));
    const defense = PlaySchema.safeParse(converted(d.defense));
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

/** Freestyle ball spot (LOS position), kept apart from the board draft so "Mới" keeps it. */
export const BALL_KEY = 'flagbook.freestyle.ball.v1';

export function loadBallSpot(): BallSpot | null {
  try {
    const raw = localStorage.getItem(BALL_KEY);
    if (raw === null) return null;
    const d = JSON.parse(raw) as Record<string, unknown> | null;
    if (!d || typeof d.x !== 'number' || typeof d.yardLine !== 'number') return null;
    if (!Number.isFinite(d.x) || !Number.isFinite(d.yardLine)) return null;
    return { x: d.x, yardLine: d.yardLine };
  } catch {
    return null;
  }
}

export function saveBallSpot(ballSpot: BallSpot): void {
  try {
    localStorage.setItem(BALL_KEY, JSON.stringify(ballSpot));
  } catch {
    // storage unavailable: the LOS just won't survive a reload
  }
}

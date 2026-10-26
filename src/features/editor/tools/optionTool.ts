/**
 * Option route tool (FR-OFF-08): press a receiver, click the stem + Enter, the vs-man branch + Enter, the
 * vs-zone branch + Enter. Esc cancels at any phase. Branches start at the stem end.
 * Draft: `{ kind: 'generic', data: { tool: 'option', slotId, phase, stem, vsMan, vsZone, points, cursor } }`.
 */
import { pointsEqual } from '@/domain/geometry';
import type { ID, Point } from '@/domain/types';
import { routeStart, setOptionRoute } from '../ops';
import { selectTool } from './selectTool';
import type { EditorTool, ToolContext } from './types';

export type OptionPhase = 'stem' | 'vsMan' | 'vsZone';

export interface OptionDraft {
  slotId: ID;
  phase: OptionPhase;
  stem: Point[];
  vsMan: Point[];
  vsZone: Point[];
  /** Points of the phase being drawn. */
  points: Point[];
  cursor: Point | null;
}

/** Reads the option draft from the store (also used by the canvas to render it). */
export function readOptionDraft(
  draft: { kind: string; data?: Record<string, unknown> } | null,
): OptionDraft | null {
  if (draft?.kind !== 'generic' || draft.data?.['tool'] !== 'option') return null;
  return draft.data as unknown as OptionDraft;
}

function optionDraft(ctx: ToolContext): OptionDraft | null {
  return readOptionDraft(ctx.getState().draft);
}

function put(ctx: ToolContext, d: OptionDraft): void {
  ctx.getState().setDraft({ kind: 'generic', data: { tool: 'option', ...d } });
}

/** Anchor of the first segment of the current phase. */
function anchor(d: OptionDraft, ctx: ToolContext): Point | null {
  const play = ctx.getState().play;
  if (!play) return null;
  if (d.phase === 'stem') return routeStart(play, d.slotId);
  return d.stem[d.stem.length - 1] ?? routeStart(play, d.slotId);
}

function collapse(points: Point[], from: Point | null): Point[] {
  const out: Point[] = [];
  let prev = from;
  for (const p of points) {
    if (prev && pointsEqual(prev, p)) continue;
    out.push(p);
    prev = p;
  }
  return out;
}

/** Enter: close the current phase and move to the next; the last phase commits one undo step. */
function advance(ctx: ToolContext): void {
  const d = optionDraft(ctx);
  if (!d) return;
  const points = collapse(d.points, anchor(d, ctx));
  if (points.length === 0) return;
  if (d.phase === 'stem') {
    put(ctx, { ...d, phase: 'vsMan', stem: points, points: [], cursor: null });
  } else if (d.phase === 'vsMan') {
    put(ctx, { ...d, phase: 'vsZone', vsMan: points, points: [], cursor: null });
  } else {
    const state = ctx.getState();
    state.setDraft(null);
    state.apply('setOption', setOptionRoute(d.slotId, { stem: d.stem, vsMan: d.vsMan, vsZone: points }));
    state.select([d.slotId]);
    state.setSelectedPoint(null);
  }
}

export const optionTool: EditorTool = {
  id: 'option',
  cursor: 'crosshair',

  onPointerDown(e, ctx) {
    if (e.button !== 0) return;
    const state = ctx.getState();
    const d = optionDraft(ctx);
    if (!d) {
      if (e.target.kind !== 'player' || state.play?.side !== 'offense') return;
      const slotId = e.target.slotId;
      const slot = state.play.players.find((s) => s.id === slotId);
      if (!slot || slot.role === 'QB') return;
      put(ctx, { slotId, phase: 'stem', stem: [], vsMan: [], vsZone: [], points: [], cursor: null });
      state.select([slotId]);
      state.setSelectedPoint(null);
      return;
    }
    put(ctx, { ...d, points: [...d.points, e.point], cursor: e.point });
  },

  onPointerMove(e, ctx) {
    const d = optionDraft(ctx);
    if (!d || (d.cursor && pointsEqual(d.cursor, e.point, 1e-9))) return;
    put(ctx, { ...d, cursor: e.point });
  },

  onKeyDown(e, ctx) {
    const d = optionDraft(ctx);
    if (e.key === 'Enter') {
      if (!d) return false;
      advance(ctx);
      return true;
    }
    if (e.key === 'Escape') {
      if (!d) return false;
      ctx.getState().setDraft(null);
      return true;
    }
    if (d) return false;
    return selectTool.onKeyDown?.(e, ctx) ?? false;
  },

  onDeactivate(ctx) {
    if (optionDraft(ctx)) ctx.getState().setDraft(null);
  },
};

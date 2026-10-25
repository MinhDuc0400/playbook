/**
 * Zone tool (FR-DEF-03): with one defender selected, click the field to draw a custom zone polygon
 * (Enter / double-click finishes with ≥ 3 points, Esc cancels); drag a zone's drop point handle.
 * Presets are chosen in the defense panel. The polygon in progress lives in `store.draft` (kind 'polygon');
 * a drop point drag uses a generic draft and one gesture = one undo step.
 */
import type { ID, Point } from '@/domain/types';
import { setDropPoint, setZone } from '../defense/ops';
import type { EditorTool, ToolContext } from './types';

const MIN_POINTS = 3;

function polygonDraft(ctx: ToolContext) {
  const draft = ctx.getState().draft;
  return draft?.kind === 'polygon' ? draft : null;
}

function readDropDrag(ctx: ToolContext): ID | null {
  const draft = ctx.getState().draft;
  if (draft?.kind !== 'generic') return null;
  const drag = draft.data.dropPointDrag as { slotId: ID } | undefined;
  return drag?.slotId ?? null;
}

function endDropDrag(ctx: ToolContext): void {
  if (readDropDrag(ctx) === null) return;
  const state = ctx.getState();
  state.endGesture();
  state.setDraft(null);
}

/** Apply the polygon draft as a custom zone; false (nothing changed) with fewer than 3 points. */
function finishPolygon(ctx: ToolContext): boolean {
  const draft = polygonDraft(ctx);
  if (!draft || draft.points.length < MIN_POINTS) return false;
  const state = ctx.getState();
  const polygon: Point[] = draft.points.map((p) => ({ x: p.x, y: p.y }));
  state.apply('zone polygon', setZone(draft.slotId, { polygon }, ctx.field));
  state.setDraft(null);
  return true;
}

export const zoneTool: EditorTool = {
  id: 'zone',
  key: 'z',

  onPointerDown(e, ctx) {
    if (e.button !== 0) return;
    const state = ctx.getState();
    const play = state.play;
    if (!play || play.side !== 'defense') return;
    const target = e.target;

    if (target.kind === 'player') {
      const draft = polygonDraft(ctx);
      if (draft && draft.slotId !== target.slotId) state.setDraft(null);
      state.setSelectedPoint(null);
      state.select([target.slotId]);
      return;
    }

    if (target.kind === 'dropPoint') {
      if (polygonDraft(ctx)) return;
      state.select([target.slotId]);
      state.beginGesture();
      state.setDraft({ kind: 'generic', data: { dropPointDrag: { slotId: target.slotId } } });
      return;
    }

    if (target.kind !== 'field' && target.kind !== 'ghost') return;
    const slotId = state.selection.length === 1 ? state.selection[0] : undefined;
    if (!slotId || !play.players.some((s) => s.id === slotId)) return;
    const draft = polygonDraft(ctx);
    const base = draft && draft.slotId === slotId ? draft.points : [];
    const last = base[base.length - 1];
    // The second press of a double-click lands on the same spot: do not add a duplicate vertex.
    if (e.detail >= 2 && last && last.x === e.point.x && last.y === e.point.y) return;
    state.setDraft({
      kind: 'polygon',
      slotId,
      points: [...base, { x: e.point.x, y: e.point.y }],
      cursor: null,
    });
  },

  onPointerMove(e, ctx) {
    const state = ctx.getState();
    const dragSlot = readDropDrag(ctx);
    if (dragSlot !== null) {
      state.apply('moveDropPoint', setDropPoint(dragSlot, e.point));
      return;
    }
    const draft = polygonDraft(ctx);
    if (draft) state.setDraft({ ...draft, cursor: { x: e.point.x, y: e.point.y } });
  },

  onPointerUp(_e, ctx) {
    endDropDrag(ctx);
  },

  onDoubleClick(_e, ctx) {
    finishPolygon(ctx);
  },

  onKeyDown(e, ctx) {
    const draft = polygonDraft(ctx);
    if (e.key === 'Enter') {
      if (!draft) return false;
      finishPolygon(ctx);
      return true;
    }
    if (e.key === 'Escape') {
      if (!draft) return false;
      ctx.getState().setDraft(null);
      return true;
    }
    return false;
  },

  onDeactivate(ctx) {
    endDropDrag(ctx);
    if (polygonDraft(ctx)) ctx.getState().setDraft(null);
  },
};

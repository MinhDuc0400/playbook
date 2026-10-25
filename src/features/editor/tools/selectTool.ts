/**
 * Select tool (FR-ED-02, FR-OFF-02): select / drag players, select / drag / insert / delete / smooth route
 * points. The drag in progress lives in `store.draft` (generic, key `drag`); one drag = one undo step.
 */
import type { ID } from '@/domain/types';
import {
  deleteRoutePoint,
  insertRoutePoint,
  moveRoutePoint,
  movePlayer,
  removePlayers,
  toggleRoutePointSmooth,
} from '../ops';
import type { EditorTool, FieldPointerEvent, ToolContext } from './types';

type Drag = { type: 'player'; slotId: ID } | { type: 'routePoint'; slotId: ID; index: number };

function readDrag(ctx: ToolContext): Drag | null {
  const draft = ctx.getState().draft;
  if (draft?.kind !== 'generic') return null;
  const drag = draft.data.drag as Drag | undefined;
  return drag ?? null;
}

function writeDrag(ctx: ToolContext, drag: Drag): void {
  ctx.getState().setDraft({ kind: 'generic', data: { drag } });
}

function endDrag(ctx: ToolContext): void {
  const state = ctx.getState();
  if (readDrag(ctx)) {
    state.endGesture();
    state.setDraft(null);
  }
}

/** Select the player under the pointer and start dragging it (shared with the place tool). */
export function startPlayerDrag(slotId: ID, e: FieldPointerEvent, ctx: ToolContext): void {
  const state = ctx.getState();
  state.setSelectedPoint(null);
  if (e.shiftKey) {
    const has = state.selection.includes(slotId);
    state.select(has ? state.selection.filter((id) => id !== slotId) : [...state.selection, slotId]);
    if (has) return; // deselected: no drag
  } else if (!state.selection.includes(slotId) || state.selection.length > 1) {
    state.select([slotId]);
  }
  state.beginGesture();
  writeDrag(ctx, { type: 'player', slotId });
}

export function dragMove(e: FieldPointerEvent, ctx: ToolContext): void {
  const drag = readDrag(ctx);
  if (!drag) return;
  const state = ctx.getState();
  const recipe =
    drag.type === 'player'
      ? movePlayer(drag.slotId, e.point)
      : moveRoutePoint(drag.slotId, drag.index, e.point);
  state.apply(drag.type === 'player' ? 'movePlayer' : 'moveRoutePoint', recipe);
}

export function dragEnd(ctx: ToolContext): void {
  endDrag(ctx);
}

export const selectTool: EditorTool = {
  id: 'select',
  key: 'v',

  onPointerDown(e, ctx) {
    if (e.button !== 0) return;
    const state = ctx.getState();
    const target = e.target;
    switch (target.kind) {
      case 'player':
        startPlayerDrag(target.slotId, e, ctx);
        return;
      case 'routePoint':
        state.select([target.slotId]);
        state.setSelectedPoint({ slotId: target.slotId, index: target.index });
        state.beginGesture();
        writeDrag(ctx, { type: 'routePoint', slotId: target.slotId, index: target.index });
        return;
      case 'routeSegment':
        state.select([target.slotId]);
        state.setSelectedPoint(null);
        return;
      case 'field':
        state.select([]);
        state.setSelectedPoint(null);
        return;
      default:
        return;
    }
  },

  onPointerMove(e, ctx) {
    dragMove(e, ctx);
  },

  onPointerUp(_e, ctx) {
    dragEnd(ctx);
  },

  onDoubleClick(e, ctx) {
    const state = ctx.getState();
    const target = e.target;
    if (target.kind === 'routePoint') {
      state.apply('toggleRoutePointSmooth', toggleRoutePointSmooth(target.slotId, target.index));
    } else if (target.kind === 'routeSegment') {
      state.apply('insertRoutePoint', insertRoutePoint(target.slotId, target.index, e.point));
      state.select([target.slotId]);
      state.setSelectedPoint({ slotId: target.slotId, index: target.index });
    }
  },

  onKeyDown(e, ctx) {
    const state = ctx.getState();
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (state.selectedPoint) {
        const { slotId, index } = state.selectedPoint;
        state.setSelectedPoint(null);
        state.apply('deleteRoutePoint', deleteRoutePoint(slotId, index));
        return true;
      }
      if (state.selection.length > 0) {
        const ids = state.selection;
        state.select([]);
        state.apply('removePlayers', removePlayers(ids));
        return true;
      }
      return false;
    }
    if (e.key === 'Escape') {
      if (state.selection.length === 0 && !state.selectedPoint) return false;
      state.select([]);
      state.setSelectedPoint(null);
      return true;
    }
    return false;
  },

  onDeactivate(ctx) {
    endDrag(ctx);
  },
};

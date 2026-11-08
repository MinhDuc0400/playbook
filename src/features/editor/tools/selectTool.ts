/**
 * Select tool (FR-ED-02, FR-OFF-02): select / drag players, select / drag / insert / delete / smooth route
 * points. The drag in progress lives in `store.draft` (generic, key `drag`); one drag = one undo step.
 * D-45: dragging any selected player moves the whole selection (routes and zones follow); dragging on the
 * empty field draws a box (`draft.data.box`, raw yards) that selects the players whose spot is inside it.
 */
import type { ID, Play, Point } from '@/domain/types';
import {
  deleteRoutePoint,
  insertRoutePoint,
  moveRoutePoint,
  movePlayers,
  removePlayers,
  toggleRoutePointSmooth,
} from '../ops';
import type { EditorTool, FieldPointerEvent, ToolContext } from './types';

/** `ids` = the players that move with the grabbed `slotId`; `moved` = the pointer has moved them. */
type Drag =
  | { type: 'player'; slotId: ID; ids: ID[]; moved: boolean; shift: boolean }
  | { type: 'routePoint'; slotId: ID; index: number }
  | { type: 'box'; from: Point; base: ID[] };

/** Players whose start is inside the box spanned by a and b (inclusive), in play order. */
function playersInBox(play: Play, a: Point, b: Point): ID[] {
  const [x0, x1] = a.x <= b.x ? [a.x, b.x] : [b.x, a.x];
  const [y0, y1] = a.y <= b.y ? [a.y, b.y] : [b.y, a.y];
  return play.players
    .filter((s) => s.start.x >= x0 && s.start.x <= x1 && s.start.y >= y0 && s.start.y <= y1)
    .map((s) => s.id);
}

function readDrag(ctx: ToolContext): Drag | null {
  const draft = ctx.getState().draft;
  if (draft?.kind !== 'generic') return null;
  const drag = draft.data.drag as Drag | undefined;
  return drag ?? null;
}

function writeDrag(ctx: ToolContext, drag: Drag, box?: { from: Point; to: Point }): void {
  ctx.getState().setDraft({ kind: 'generic', data: box ? { drag, box } : { drag } });
}

function endDrag(ctx: ToolContext): void {
  const state = ctx.getState();
  const drag = readDrag(ctx);
  if (!drag) return;
  if (drag.type !== 'box') state.endGesture();
  // A click (no drag) on one player of a group selects just that one.
  if (drag.type === 'player' && !drag.moved && drag.ids.length > 1 && !drag.shift)
    state.select([drag.slotId]);
  state.setDraft(null);
}

/**
 * Select the player under the pointer and start dragging it (shared with the place tool). A player that is
 * already part of the selection drags the whole selection.
 */
export function startPlayerDrag(slotId: ID, e: FieldPointerEvent, ctx: ToolContext): void {
  const state = ctx.getState();
  state.setSelectedPoint(null);
  if (e.shiftKey) {
    const has = state.selection.includes(slotId);
    state.select(has ? state.selection.filter((id) => id !== slotId) : [...state.selection, slotId]);
    if (has) return; // deselected: no drag
  } else if (!state.selection.includes(slotId)) {
    state.select([slotId]);
  }
  state.beginGesture();
  writeDrag(ctx, {
    type: 'player',
    slotId,
    ids: ctx.getState().selection.slice(),
    moved: false,
    shift: e.shiftKey,
  });
}

export function dragMove(e: FieldPointerEvent, ctx: ToolContext): void {
  const drag = readDrag(ctx);
  if (!drag) return;
  const state = ctx.getState();
  if (drag.type === 'box') {
    const play = state.play;
    if (!play) return;
    const inside = playersInBox(play, drag.from, e.raw).filter((id) => !drag.base.includes(id));
    state.select([...drag.base, ...inside]);
    writeDrag(ctx, drag, { from: drag.from, to: e.raw });
    return;
  }
  if (drag.type === 'routePoint') {
    state.apply('moveRoutePoint', moveRoutePoint(drag.slotId, drag.index, e.point));
    return;
  }
  // The grabbed player goes to the pointer; the rest of the group keeps its spacing.
  const grabbed = state.play?.players.find((s) => s.id === drag.slotId);
  if (!grabbed) return;
  const delta = { x: e.point.x - grabbed.start.x, y: e.point.y - grabbed.start.y };
  if (delta.x === 0 && delta.y === 0) return;
  state.apply('movePlayers', movePlayers(drag.ids, delta));
  if (!drag.moved) writeDrag(ctx, { ...drag, moved: true });
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
      case 'field': {
        const base = e.shiftKey ? state.selection.slice() : [];
        state.select(base);
        state.setSelectedPoint(null);
        writeDrag(ctx, { type: 'box', from: e.raw, base });
        return;
      }
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

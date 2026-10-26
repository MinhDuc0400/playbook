/**
 * Route tool (FR-OFF-01): press an offense player (not the QB), click each break point, Enter or
 * double-click to finish, Shift locks 45 degrees, Esc cancels. The draft lives in `store.draft`.
 */
import { pointsEqual, snapAngle45 } from '@/domain/geometry';
import type { Point } from '@/domain/types';
import type { EditorDraft } from '@/store/editorStore';
import { routeStart, setRoute } from '../ops';
import { selectTool } from './selectTool';
import type { EditorTool, FieldPointerEvent, ToolContext } from './types';

type RouteDraft = Extract<EditorDraft, { kind: 'route' }>;

function routeDraft(ctx: ToolContext): RouteDraft | null {
  const draft = ctx.getState().draft;
  return draft?.kind === 'route' ? draft : null;
}

/** Where the route begins (motion end or start), used as the anchor of the first segment. */
function startOf(draft: RouteDraft, ctx: ToolContext): Point | null {
  const play = ctx.getState().play;
  return play?.players.some((s) => s.id === draft.slotId) ? routeStart(play, draft.slotId) : null;
}

/** Point to use for a click: Shift locks the angle relative to the previous point. */
function constrain(draft: RouteDraft, e: FieldPointerEvent, ctx: ToolContext): Point {
  if (!e.shiftKey) return e.point;
  const anchor = draft.points[draft.points.length - 1] ?? startOf(draft, ctx);
  return anchor ? snapAngle45(anchor, e.point) : e.point;
}

/** Drop points equal to their predecessor (the slot start counts as the first predecessor). */
function collapse(draft: RouteDraft, start: Point | null): Point[] {
  const out: Point[] = [];
  let prev: Point | null = start;
  for (const p of draft.points) {
    if (prev && pointsEqual(prev, p)) continue;
    out.push(p);
    prev = p;
  }
  return out;
}

function finish(ctx: ToolContext): void {
  const draft = routeDraft(ctx);
  if (!draft) return;
  const state = ctx.getState();
  const path = collapse(draft, startOf(draft, ctx));
  state.setDraft(null);
  if (path.length === 0) return;
  state.apply(
    'setRoute',
    setRoute(draft.slotId, {
      type: 'route',
      path,
      smooth: path.map(() => false),
      endBehavior: 'continue',
    }),
  );
  state.select([draft.slotId]);
  state.setSelectedPoint(null);
}

export const routeTool: EditorTool = {
  id: 'route',
  key: 'r',
  cursor: 'crosshair',

  onPointerDown(e, ctx) {
    if (e.button !== 0) return;
    const state = ctx.getState();
    const draft = routeDraft(ctx);
    if (!draft) {
      if (e.target.kind !== 'player' || state.play?.side !== 'offense') return;
      const slotId = e.target.slotId;
      const slot = state.play.players.find((s) => s.id === slotId);
      if (!slot || slot.role === 'QB') return;
      state.setDraft({ kind: 'route', slotId, points: [], smooth: [], cursor: null });
      state.select([slotId]);
      state.setSelectedPoint(null);
      return;
    }
    const p = constrain(draft, e, ctx);
    state.setDraft({
      ...draft,
      points: [...draft.points, p],
      smooth: [...draft.smooth, false],
      cursor: p,
    });
  },

  onPointerMove(e, ctx) {
    const draft = routeDraft(ctx);
    if (!draft) return;
    const p = constrain(draft, e, ctx);
    if (draft.cursor && pointsEqual(draft.cursor, p, 1e-9)) return;
    ctx.getState().setDraft({ ...draft, cursor: p });
  },

  onDoubleClick(_e, ctx) {
    finish(ctx);
  },

  onKeyDown(e, ctx) {
    const draft = routeDraft(ctx);
    if (e.key === 'Enter') {
      if (!draft) return false;
      finish(ctx);
      return true;
    }
    if (e.key === 'Escape') {
      if (!draft) return false;
      ctx.getState().setDraft(null);
      return true;
    }
    if (draft) return false;
    return selectTool.onKeyDown?.(e, ctx) ?? false;
  },

  onDeactivate(ctx) {
    if (routeDraft(ctx)) ctx.getState().setDraft(null);
  },
};

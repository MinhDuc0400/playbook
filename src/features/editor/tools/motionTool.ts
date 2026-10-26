/**
 * Motion tool (FR-OFF-07): press an offense player, click the motion points, Enter or double-click to finish
 * (one undo step), Esc cancels. Draft: `{ kind: 'generic', data: { tool: 'motion', slotId, points, cursor } }`.
 */
import { pointsEqual } from '@/domain/geometry';
import type { ID, Point } from '@/domain/types';
import { setMotion } from '../ops';
import { selectTool } from './selectTool';
import type { EditorTool, ToolContext } from './types';

interface MotionDraft {
  slotId: ID;
  points: Point[];
  cursor: Point | null;
}

function motionDraft(ctx: ToolContext): MotionDraft | null {
  const draft = ctx.getState().draft;
  if (draft?.kind !== 'generic' || draft.data['tool'] !== 'motion') return null;
  return draft.data as unknown as MotionDraft;
}

function put(ctx: ToolContext, d: MotionDraft): void {
  ctx.getState().setDraft({ kind: 'generic', data: { tool: 'motion', ...d } });
}

function finish(ctx: ToolContext): void {
  const d = motionDraft(ctx);
  if (!d) return;
  const state = ctx.getState();
  const start = state.play?.players.find((s) => s.id === d.slotId)?.start;
  const points: Point[] = [];
  let prev = start ?? null;
  for (const p of d.points) {
    if (prev && pointsEqual(prev, p)) continue;
    points.push(p);
    prev = p;
  }
  state.setDraft(null);
  if (points.length === 0) return;
  state.apply('setMotion', setMotion(d.slotId, points));
  state.select([d.slotId]);
  state.setSelectedPoint(null);
}

export const motionTool: EditorTool = {
  id: 'motion',
  cursor: 'crosshair',

  onPointerDown(e, ctx) {
    if (e.button !== 0) return;
    const state = ctx.getState();
    const d = motionDraft(ctx);
    if (!d) {
      if (e.target.kind !== 'player' || state.play?.side !== 'offense') return;
      const slotId = e.target.slotId;
      const slot = state.play.players.find((s) => s.id === slotId);
      if (!slot || slot.role === 'QB') return;
      put(ctx, { slotId, points: [], cursor: null });
      state.select([slotId]);
      state.setSelectedPoint(null);
      return;
    }
    put(ctx, { ...d, points: [...d.points, e.point], cursor: e.point });
  },

  onPointerMove(e, ctx) {
    const d = motionDraft(ctx);
    if (!d || (d.cursor && pointsEqual(d.cursor, e.point, 1e-9))) return;
    put(ctx, { ...d, cursor: e.point });
  },

  onDoubleClick(_e, ctx) {
    finish(ctx);
  },

  onKeyDown(e, ctx) {
    const d = motionDraft(ctx);
    if (e.key === 'Enter') {
      if (!d) return false;
      finish(ctx);
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
    if (motionDraft(ctx)) ctx.getState().setDraft(null);
  },
};

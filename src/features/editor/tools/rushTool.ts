/**
 * Rush tool (FR-DEF-04): click a defender to make it a designated rusher (role R, path to the QB) or to
 * clear its rush; drag rush path points; double-click a rush segment to insert a point.
 * A drag uses a generic draft (key `rushDrag`) and one gesture = one undo step. Exceeding maxRushers is
 * allowed here (validate warns).
 */
import type { ID, Play, Point } from '@/domain/types';
import { clearAssignment, setRush, setRushPath } from '../defense/ops';
import type { EditorTool, ToolContext } from './types';

interface RushDrag {
  slotId: ID;
  index: number;
}

function rushPath(play: Play | null, slotId: ID): Point[] | undefined {
  const slot = play?.players.find((s) => s.id === slotId);
  const rush = slot?.actions.find((a) => a.type === 'rush');
  return rush?.type === 'rush' ? rush.path : undefined;
}

function readDrag(ctx: ToolContext): RushDrag | null {
  const draft = ctx.getState().draft;
  if (draft?.kind !== 'generic') return null;
  return (draft.data.rushDrag as RushDrag | undefined) ?? null;
}

function endDrag(ctx: ToolContext): void {
  if (!readDrag(ctx)) return;
  const state = ctx.getState();
  state.endGesture();
  state.setDraft(null);
}

export const rushTool: EditorTool = {
  id: 'rush',
  key: 'b',

  onPointerDown(e, ctx) {
    if (e.button !== 0) return;
    const state = ctx.getState();
    const play = state.play;
    if (!play || play.side !== 'defense') return;
    const target = e.target;

    if (target.kind === 'player') {
      const hasRush = rushPath(play, target.slotId) !== undefined;
      state.apply(
        hasRush ? 'clear rush' : 'set rush',
        hasRush ? clearAssignment(target.slotId) : setRush(target.slotId),
      );
      state.setSelectedPoint(null);
      state.select([target.slotId]);
      return;
    }

    if (target.kind === 'routePoint') {
      if (!rushPath(play, target.slotId)) return;
      state.select([target.slotId]);
      state.beginGesture();
      state.setDraft({
        kind: 'generic',
        data: { rushDrag: { slotId: target.slotId, index: target.index } satisfies RushDrag },
      });
    }
  },

  onPointerMove(e, ctx) {
    const drag = readDrag(ctx);
    if (!drag) return;
    const state = ctx.getState();
    const path = rushPath(state.play, drag.slotId);
    if (!path || drag.index < 0 || drag.index >= path.length) return;
    const next = path.map((p, i) => (i === drag.index ? { x: e.point.x, y: e.point.y } : p));
    state.apply('moveRushPoint', setRushPath(drag.slotId, next));
  },

  onPointerUp(_e, ctx) {
    endDrag(ctx);
  },

  onDoubleClick(e, ctx) {
    const target = e.target;
    if (target.kind !== 'routeSegment') return;
    const state = ctx.getState();
    const path = rushPath(state.play, target.slotId);
    if (!path) return;
    const at = Math.max(0, Math.min(target.index, path.length));
    const next = [...path.slice(0, at), { x: e.point.x, y: e.point.y }, ...path.slice(at)];
    state.apply('insertRushPoint', setRushPath(target.slotId, next));
    state.select([target.slotId]);
  },

  onDeactivate(ctx) {
    endDrag(ctx);
  },
};

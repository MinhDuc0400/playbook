/**
 * Place tool (FR-ED-02): click the field to add a player with the next default role/label; pressing a
 * player behaves like the select tool so it can be repositioned without switching tools.
 */
import type { ID, Play, Role } from '@/domain/types';
import { addPlayer } from '../ops';
import { dragEnd, dragMove, selectTool, startPlayerDrag } from './selectTool';
import type { EditorTool } from './types';

const count = (play: Play, role: Role): number => play.players.filter((s) => s.role === role).length;

/** Next role to place: offense QB, then C, then WR; defense CB x2, S x2, then LB. */
export function nextRole(play: Play): Role {
  if (play.side === 'offense') {
    if (count(play, 'QB') === 0) return 'QB';
    if (count(play, 'C') === 0) return 'C';
    return 'WR';
  }
  if (count(play, 'CB') < 2) return 'CB';
  if (count(play, 'S') < 2) return 'S';
  return 'LB';
}

export const placeTool: EditorTool = {
  id: 'place',
  key: 'p',

  onPointerDown(e, ctx) {
    if (e.button !== 0) return;
    const state = ctx.getState();
    if (e.target.kind === 'player') {
      startPlayerDrag(e.target.slotId, e, ctx);
      return;
    }
    if (e.target.kind !== 'field' || !state.play) return;
    let newId: ID | undefined;
    state.apply(
      'addPlayer',
      addPlayer(nextRole(state.play), e.point, ctx.maxPlayers, () => {
        newId = ctx.idGen();
        return newId;
      }),
    );
    if (newId !== undefined) {
      state.select([newId]);
      state.setSelectedPoint(null);
    }
  },

  onPointerMove(e, ctx) {
    dragMove(e, ctx);
  },

  onPointerUp(_e, ctx) {
    dragEnd(ctx);
  },

  onKeyDown(e, ctx) {
    return selectTool.onKeyDown?.(e, ctx) ?? false;
  },

  onDeactivate(ctx) {
    dragEnd(ctx);
  },
};

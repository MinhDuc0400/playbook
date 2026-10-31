/**
 * Man tool (FR-DEF-02): press a defender, then press a ghost receiver. The assignment is stored as a
 * ReceiverRef (strong #1, role QB...), never an id. Esc / field click cancels. The draft lives in `store.draft`.
 */
import { alignedPlayers, numberReceivers, refForPlayer } from '@/domain/numbering';
import type { ManAction } from '@/domain/types';
import { setMan } from '../defense/ops';
import { ghostNumbering, ghostPlayers } from '../defense/ghost';
import type { EditorTool, ToolContext } from './types';

function manDraftSlot(ctx: ToolContext): string | null {
  const draft = ctx.getState().draft;
  return draft?.kind === 'man' ? draft.slotId : null;
}

function clearManDraft(ctx: ToolContext): boolean {
  if (manDraftSlot(ctx) === null) return false;
  ctx.getState().setDraft(null);
  return true;
}

export const manTool: EditorTool = {
  id: 'man',
  key: 'm',
  cursor: 'crosshair',

  onPointerDown(e, ctx) {
    if (e.button !== 0) return;
    const state = ctx.getState();
    const play = state.play;
    if (!play || play.side !== 'defense') return;
    const target = e.target;

    if (target.kind === 'player') {
      state.setDraft({ kind: 'man', slotId: target.slotId });
      state.select([target.slotId]);
      state.setSelectedPoint(null);
      return;
    }

    if (target.kind === 'ghost' || target.kind === 'offenseToken') {
      const slotId = manDraftSlot(ctx);
      if (!slotId) return;
      let ref;
      if (target.kind === 'ghost') {
        ref = refForPlayer(
          target.ghostId,
          ghostNumbering(play.format, state.ghostFormationId),
          ghostPlayers(play.format, state.ghostFormationId),
        );
      } else {
        // Freestyle: number the live offense (companion), never store a slot id.
        const live = state.companion;
        if (!live || live.side !== 'offense') return;
        const players = alignedPlayers(live);
        ref = refForPlayer(target.slotId, numberReceivers(players), players);
      }
      if (!ref) return;
      const existing = play.players
        .find((s) => s.id === slotId)
        ?.actions.find((a): a is ManAction => a.type === 'man');
      state.apply('man', setMan(slotId, ref, existing?.technique ?? 'trail', existing?.cushion));
      state.setDraft(null);
      return;
    }

    if (target.kind === 'field') clearManDraft(ctx);
  },

  onKeyDown(e, ctx) {
    if (e.key === 'Escape') return clearManDraft(ctx);
    return false;
  },

  onDeactivate(ctx) {
    clearManDraft(ctx);
  },
};

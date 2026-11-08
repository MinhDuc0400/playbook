/**
 * Editor keyboard shortcuts (SRS §12.3): tool hotkeys, F flip, undo/redo, Ctrl+C / Ctrl+V copy-paste and Ctrl+D
 * duplicate of the selected players, Ctrl+A select all.
 */
import { nanoid } from 'nanoid';
import { useEffect } from 'react';
import { duplicatePlayer, flip, pastePlayers } from '@/features/editor/ops';
import { TOOLBAR, TOOLS } from '@/features/editor/tools';
import type { PlayerSlot, Side } from '@/domain/types';
import { useEditorStore } from '@/store/editorStore';

/** D-50: players copied with Ctrl+C (in-app, not the OS clipboard); each paste lands 1 yd further. */
let clipboard: { side: Side; slots: PlayerSlot[]; pastes: number } | null = null;

const EDITABLE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable === true || target.closest(EDITABLE) !== null;
}

/** `maxPlayers` = field.playersPerSide of the play's format (limit for Ctrl+D). */
export function useEditorShortcuts(maxPlayers: number): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (isTypingTarget(e.target) || isTypingTarget(document.activeElement)) return;
      if (document.querySelector('[role="dialog"]')) return;
      const store = useEditorStore.getState();
      const play = store.play;
      if (!play) return;
      const key = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;

      if (mod && !e.altKey) {
        if (key === 'z') {
          e.preventDefault();
          if (e.shiftKey) store.redo();
          else store.undo();
        } else if (key === 'y') {
          e.preventDefault();
          store.redo();
        } else if (key === 'c') {
          const ids = new Set(store.selection);
          const slots = play.players.filter((p) => ids.has(p.id));
          if (slots.length === 0) return; // nothing selected: keep the old clipboard, normal copy
          e.preventDefault();
          clipboard = {
            side: play.side,
            slots: JSON.parse(JSON.stringify(slots)) as PlayerSlot[],
            pastes: 0,
          };
        } else if (key === 'v') {
          if (!clipboard || clipboard.side !== play.side) return;
          e.preventDefault();
          clipboard.pastes += 1;
          const ids = clipboard.slots.map(() => nanoid());
          const before = play.players.length;
          store.apply(
            'paste players',
            pastePlayers(clipboard.slots, ids, clipboard.pastes, maxPlayers, nanoid),
          );
          const added = (useEditorStore.getState().play?.players.length ?? before) - before;
          if (added > 0) {
            store.setTool('select');
            useEditorStore.getState().select(ids.slice(0, added));
          }
        } else if (key === 'a') {
          // D-45: select every player of the side being edited, ready to drag.
          e.preventDefault();
          store.setTool('select');
          useEditorStore.getState().select(play.players.map((p) => p.id));
        } else if (key === 'd') {
          e.preventDefault();
          const ids = store.selection.slice();
          // One undo step for the whole selection.
          store.apply('duplicate-player', (p) =>
            ids.reduce((acc, id) => duplicatePlayer(id, maxPlayers, nanoid)(acc), p),
          );
        }
        return;
      }
      if (e.altKey) return;

      if (key === 'f') {
        e.preventDefault();
        store.apply('flip', flip());
        return;
      }
      for (const id of TOOLBAR[play.side]) {
        if (TOOLS[id]?.key?.toLowerCase() === key) {
          e.preventDefault();
          store.setTool(id);
          return;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [maxPlayers]);
}

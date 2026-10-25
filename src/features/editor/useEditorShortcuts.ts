/** Editor keyboard shortcuts (SRS §12.3): tool hotkeys, F flip, undo/redo, Ctrl+D duplicate. */
import { nanoid } from 'nanoid';
import { useEffect } from 'react';
import { duplicatePlayer, flip } from '@/features/editor/ops';
import { TOOLBAR, TOOLS } from '@/features/editor/tools';
import { useEditorStore } from '@/store/editorStore';

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

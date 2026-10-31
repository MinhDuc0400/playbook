/** Debounced draft autosave with flush on pagehide/unmount (FR-FS-09). */
import { useEffect } from 'react';
import type { Play } from '@/domain/types';
import { useEditorStore } from '@/store/editorStore';
import { clearDraft, saveDraft } from './draft';

export const AUTOSAVE_MS = 400;

function snapshot(): { offense: Play; defense: Play; activeSide: 'offense' | 'defense' } | null {
  const { play, companion } = useEditorStore.getState();
  if (!play || !companion) return null;
  const offense = play.side === 'offense' ? play : companion;
  const defense = play.side === 'defense' ? play : companion;
  if (offense.side !== 'offense' || defense.side !== 'defense') return null;
  return { offense, defense, activeSide: play.side };
}

/** Write the current board now. */
export function flushDraft(): void {
  const s = snapshot();
  if (!s) return;
  // A blank board is not worth keeping (and is what "Mới" leaves behind).
  if (s.offense.players.length === 0 && s.defense.players.length === 0) clearDraft();
  else saveDraft({ v: 1, ...s });
}

/** While `enabled`, persists store changes (skipping the state present at subscribe time). */
export function useFreestyleDraft(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let dirty = false;
    const flush = (): void => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      if (!dirty) return;
      dirty = false;
      flushDraft();
    };
    const unsub = useEditorStore.subscribe((s, prev) => {
      if (s.play === prev.play && s.companion === prev.companion) return;
      dirty = true;
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(flush, AUTOSAVE_MS);
    });
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      unsub();
      flush();
    };
  }, [enabled]);
}

/** Trial inputs and keys for Freestyle (FR-FS-05, D-27). */
import { useDeferredValue, useEffect, useMemo } from 'react';
import type { Play } from '@/domain/types';
import { t } from '@/i18n/vi';
import { useEditorStore } from '@/store/editorStore';

export interface TrialPlays {
  offense: Play | null;
  defense: Play | null;
}

/** Offense/defense plays from the active play and the companion, whichever side each has. */
export function pickTrialPlays(play: Play | null, companion: Play | null): TrialPlays {
  const all = [play, companion];
  return {
    offense: all.find((p) => p?.side === 'offense') ?? null,
    defense: all.find((p) => p?.side === 'defense') ?? null,
  };
}

/** Why the trial cannot run, or null (FR-FS-05). */
export function trialHint({ offense, defense }: TrialPlays): string | null {
  if (!offense || offense.players.length === 0) return t.freestyle.hintNoOffense;
  if (!offense.players.some((p) => p.role === 'QB')) return t.freestyle.hintNoQb;
  if (!defense || defense.players.length === 0) return t.freestyle.hintNoDefense;
  return null;
}

/** Committed store plays, deferred so a pointer-move commit never blocks on a simulation. */
export function useTrialPlays(): TrialPlays {
  const play = useEditorStore((s) => s.play);
  const companion = useEditorStore((s) => s.companion);
  const dPlay = useDeferredValue(play);
  const dCompanion = useDeferredValue(companion);
  return useMemo(() => pickTrialPlays(dPlay, dCompanion), [dPlay, dCompanion]);
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]') !== null
  );
}

/** Space/Enter runs (edit view), Esc returns to drawing (trial view). Ignored while typing. */
export function useTrialKeys(trial: boolean, canRun: boolean, onRun: () => void, onEdit: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (isTyping(e.target) || document.querySelector('[role="dialog"]')) return;
      if (trial) {
        if (e.key === 'Escape') {
          e.preventDefault();
          onEdit();
        }
        return;
      }
      if ((e.key === ' ' || e.key === 'Enter') && canRun) {
        // A focused button handles Space/Enter natively (click).
        if (e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement) return;
        e.preventDefault();
        onRun();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [trial, canRun, onRun, onEdit]);
}

/** Matchup keyboard shortcuts (SRS §12.3, FR-MU-03): Space, ← / →, [ / ]. */
import { useEffect, useRef } from 'react';
import type { Playback } from '@/components/field/usePlayback';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

/** Fields where Space is a character or opens a list; every other focused control (button, range, checkbox) is not. */
function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement) {
    return !['range', 'checkbox', 'radio', 'button', 'submit', 'reset'].includes(target.type);
  }
  return target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable;
}

/**
 * `markers` are event times used by ← / →. Ignored while typing in a field. With `spaceAlways` (QB tự ném, D-36)
 * Space toggles play/pause whatever control kept the focus (scrubber, a button just clicked, a checkbox) and
 * never activates that control; only real text entry keeps its Space.
 */
export function useMatchupShortcuts(
  playback: Playback,
  markers: readonly number[],
  spaceAlways = false,
): void {
  const ref = useRef({ playback, markers, spaceAlways });
  useEffect(() => {
    ref.current = { playback, markers, spaceAlways };
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const { playback: pb, markers: marks, spaceAlways: always } = ref.current;
      if (always && e.key === ' ' && !isTextEntry(e.target)) {
        e.preventDefault();
        if (!e.repeat) pb.toggle();
        return;
      }
      if (isTypingTarget(e.target)) return;
      switch (e.key) {
        case ' ':
          // A focused button handles Space natively (click); do not toggle twice.
          if (e.target instanceof HTMLButtonElement) return;
          e.preventDefault();
          pb.toggle();
          break;
        case 'ArrowRight':
          e.preventDefault();
          pb.stepToMark(1, marks);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          pb.stepToMark(-1, marks);
          break;
        case '[':
          pb.slower();
          break;
        case ']':
          pb.faster();
          break;
        default:
          break;
      }
    };
    // A button is clicked by Space on keyup; swallow it too so the focused control is not activated.
    const onKeyUp = (e: KeyboardEvent): void => {
      if (ref.current.spaceAlways && e.key === ' ' && !isTextEntry(e.target)) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);
}

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
 * `markers` are event times used by ← / →. Space toggles play/pause in every mode, whatever control kept the focus
 * (scrubber, a button just clicked, a checkbox) and never activates that control (D-36); only real text entry
 * keeps its Space. The other keys are ignored while typing in a field.
 */
export function useMatchupShortcuts(playback: Playback, markers: readonly number[]): void {
  const ref = useRef({ playback, markers });
  useEffect(() => {
    ref.current = { playback, markers };
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const { playback: pb, markers: marks } = ref.current;
      if (e.key === ' ' && !isTextEntry(e.target)) {
        e.preventDefault();
        if (!e.repeat) pb.toggle();
        return;
      }
      if (isTypingTarget(e.target)) return;
      switch (e.key) {
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
      if (e.key === ' ' && !isTextEntry(e.target)) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);
}

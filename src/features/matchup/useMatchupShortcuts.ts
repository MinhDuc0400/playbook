/** Matchup keyboard shortcuts (SRS §12.3, FR-MU-03): Space, ← / →, [ / ]. */
import { useEffect, useRef } from 'react';
import type { Playback } from '@/components/field/usePlayback';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

/** `markers` are event times used by ← / →. Ignored while typing in a field. */
export function useMatchupShortcuts(playback: Playback, markers: readonly number[]): void {
  const ref = useRef({ playback, markers });
  useEffect(() => {
    ref.current = { playback, markers };
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      const { playback: pb, markers: marks } = ref.current;
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
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/**
 * Playback bar (FR-MU-03/04): play/pause, scrubber with event markers, speed buttons, prev/next event.
 * Controlled: all state comes from a Playback (usePlayback).
 */
import type { SimEventType } from '@/domain/types';
import type { Playback } from './usePlayback';

export interface TimelineMarker {
  t: number;
  type: SimEventType;
  label?: string;
}

export interface TimelineProps {
  playback: Playback;
  duration: number;
  minT?: number;
  markers?: readonly TimelineMarker[];
  /** Hide speed / event buttons (compact preview). */
  compact?: boolean;
}

export function Timeline(_props: TimelineProps): JSX.Element | null {
  return null;
}

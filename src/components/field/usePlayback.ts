/** Playback clock for frames (FR-MU-03, FR-OFF-06, FR-IN-04). requestAnimationFrame driven. */
import { notImplemented } from '@/domain/notImplemented';

export type PlaybackSpeed = 0.25 | 0.5 | 1 | 2;
export const PLAYBACK_SPEEDS: readonly PlaybackSpeed[] = [0.25, 0.5, 1, 2];

export interface Playback {
  t: number;
  playing: boolean;
  speed: PlaybackSpeed;
  loop: boolean;
  play(): void; // at the end → restarts from minT
  pause(): void;
  toggle(): void;
  seek(t: number): void; // clamped to [minT, duration]
  setSpeed(s: PlaybackSpeed): void;
  /** [ / ] keys: previous / next speed in PLAYBACK_SPEEDS (clamped). */
  slower(): void;
  faster(): void;
  setLoop(v: boolean): void;
  /** Seek to the next (dir 1) or previous (dir −1) time in `marks` strictly after/before t (±1e-6). */
  stepToMark(dir: 1 | -1, marks: readonly number[]): void;
}

/**
 * Clock advances by realDelta × speed per animation frame while playing. Reaching `duration` stops
 * (playing = false, onEnd called once) or, with loop, wraps to minT. Changing `duration` keeps t
 * (clamped) — FR §9 "giữ nguyên vị trí playhead".
 */
export function usePlayback(opts: {
  duration: number;
  minT?: number; // default 0 (motion uses t < 0)
  autoPlay?: boolean;
  loop?: boolean;
  onEnd?: () => void;
}): Playback {
  return notImplemented(`usePlayback ${String(opts)}`);
}

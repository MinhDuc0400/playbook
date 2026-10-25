/** Playback clock for frames (FR-MU-03, FR-OFF-06, FR-IN-04). requestAnimationFrame driven. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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

const MARK_EPS = 1e-6;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), Math.max(lo, hi));
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
  const { duration, minT = 0, autoPlay = false } = opts;
  const [rawT, setRawT] = useState(() => minT);
  const [playing, setPlaying] = useState(autoPlay);
  const [speed, setSpeedState] = useState<PlaybackSpeed>(1);
  const [loop, setLoopState] = useState(opts.loop ?? false);

  // Latest values for the rAF loop and the stable callbacks (written in effects, never during render).
  const tRef = useRef(rawT);
  const bounds = useRef({ minT, duration });
  const speedRef = useRef(speed);
  const loopRef = useRef(loop);
  const onEndRef = useRef(opts.onEnd);
  useEffect(() => {
    bounds.current = { minT, duration };
    speedRef.current = speed;
    loopRef.current = loop;
    onEndRef.current = opts.onEnd;
  });

  const moveTo = useCallback((next: number) => {
    tRef.current = next;
    setRawT(next);
  }, []);

  // Duration / minT changed: keep the playhead, clamped into the new range.
  useEffect(() => {
    const clamped = clamp(tRef.current, minT, duration);
    if (clamped !== tRef.current) moveTo(clamped);
  }, [minT, duration, moveTo]);

  // The clock: runs only while playing.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = Math.max(0, (now - last) / 1000);
      last = now;
      const { minT: lo, duration: hi } = bounds.current;
      let next = tRef.current + dt * speedRef.current;
      if (next >= hi) {
        if (loopRef.current && hi > lo) {
          next = lo + ((next - hi) % (hi - lo));
        } else {
          moveTo(Math.max(lo, hi));
          setPlaying(false);
          onEndRef.current?.();
          return;
        }
      }
      moveTo(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, moveTo]);

  const play = useCallback(() => {
    const { minT: lo, duration: hi } = bounds.current;
    if (tRef.current >= hi) moveTo(lo);
    setPlaying(true);
  }, [moveTo]);
  const pause = useCallback(() => setPlaying(false), []);
  const toggle = useCallback(() => {
    setPlaying((p) => {
      if (p) return false;
      const { minT: lo, duration: hi } = bounds.current;
      if (tRef.current >= hi) moveTo(lo);
      return true;
    });
  }, [moveTo]);
  const seek = useCallback(
    (to: number) => {
      const { minT: lo, duration: hi } = bounds.current;
      moveTo(clamp(Number.isFinite(to) ? to : lo, lo, hi));
    },
    [moveTo],
  );
  const setSpeed = useCallback((s: PlaybackSpeed) => setSpeedState(s), []);
  const stepSpeed = useCallback((by: 1 | -1) => {
    setSpeedState((s) => {
      const i = PLAYBACK_SPEEDS.indexOf(s) + by;
      return PLAYBACK_SPEEDS[Math.min(Math.max(i, 0), PLAYBACK_SPEEDS.length - 1)] ?? s;
    });
  }, []);
  const slower = useCallback(() => stepSpeed(-1), [stepSpeed]);
  const faster = useCallback(() => stepSpeed(1), [stepSpeed]);
  const setLoop = useCallback((v: boolean) => setLoopState(v), []);
  const stepToMark = useCallback(
    (dir: 1 | -1, marks: readonly number[]) => {
      const cur = tRef.current;
      let target: number | undefined;
      for (const m of marks) {
        if (dir === 1 && m > cur + MARK_EPS && (target === undefined || m < target)) target = m;
        if (dir === -1 && m < cur - MARK_EPS && (target === undefined || m > target)) target = m;
      }
      if (target !== undefined) moveTo(clamp(target, bounds.current.minT, bounds.current.duration));
    },
    [moveTo],
  );

  const t = clamp(rawT, minT, duration);
  return useMemo(
    () => ({
      t,
      playing,
      speed,
      loop,
      play,
      pause,
      toggle,
      seek,
      setSpeed,
      slower,
      faster,
      setLoop,
      stepToMark,
    }),
    [t, playing, speed, loop, play, pause, toggle, seek, setSpeed, slower, faster, setLoop, stepToMark],
  );
}

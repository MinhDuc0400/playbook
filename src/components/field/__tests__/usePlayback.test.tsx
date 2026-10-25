import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlayback } from '../usePlayback';

// Manual rAF + clock so tests control real elapsed time.
let now = 0;
let nextId = 1;
let callbacks = new Map<number, () => void>();

function advance(ms: number): void {
  now += ms;
  const pending = [...callbacks.entries()];
  callbacks = new Map();
  act(() => {
    for (const [, cb] of pending) cb();
  });
}

beforeEach(() => {
  now = 1000;
  nextId = 1;
  callbacks = new Map();
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
    const id = nextId++;
    callbacks.set(id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    callbacks.delete(id);
  });
  vi.spyOn(performance, 'now').mockImplementation(() => now);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('usePlayback (FR-MU-03)', () => {
  it('starts paused at minT, speed 1, loop from opts', () => {
    const { result } = renderHook(() => usePlayback({ duration: 5, minT: -1, loop: true }));
    expect(result.current).toMatchObject({ t: -1, playing: false, speed: 1, loop: true });
  });

  it('advances t by elapsed x speed (1 s at 2x -> t = 2)', () => {
    const { result } = renderHook(() => usePlayback({ duration: 10 }));
    act(() => result.current.setSpeed(2));
    act(() => result.current.play());
    advance(1000);
    expect(result.current.t).toBeCloseTo(2, 6);
    expect(result.current.playing).toBe(true);
  });

  it('stops at duration with playing=false and calls onEnd once', () => {
    const onEnd = vi.fn();
    const { result } = renderHook(() => usePlayback({ duration: 2, onEnd }));
    act(() => result.current.play());
    advance(1500);
    advance(1500);
    expect(result.current.t).toBe(2);
    expect(result.current.playing).toBe(false);
    expect(onEnd).toHaveBeenCalledTimes(1);
    advance(1000);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(callbacks.size).toBe(0);
  });

  it('loop wraps to minT, keeps playing and does not call onEnd', () => {
    const onEnd = vi.fn();
    const { result } = renderHook(() => usePlayback({ duration: 2, minT: -1, loop: true, onEnd }));
    act(() => result.current.play());
    advance(3500); // span 3 -> wraps by 0.5 past minT
    expect(result.current.playing).toBe(true);
    expect(result.current.t).toBeCloseTo(-0.5, 6);
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('setLoop toggles loop', () => {
    const { result } = renderHook(() => usePlayback({ duration: 2 }));
    act(() => result.current.setLoop(true));
    expect(result.current.loop).toBe(true);
    act(() => result.current.setLoop(false));
    expect(result.current.loop).toBe(false);
  });

  it('play() at the end restarts from minT', () => {
    const { result } = renderHook(() => usePlayback({ duration: 2, minT: -1 }));
    act(() => result.current.seek(2));
    expect(result.current.t).toBe(2);
    act(() => result.current.play());
    expect(result.current.t).toBe(-1);
    expect(result.current.playing).toBe(true);
  });

  it('toggle at the end restarts from minT; toggling again pauses', () => {
    const { result } = renderHook(() => usePlayback({ duration: 2 }));
    act(() => result.current.seek(2));
    act(() => result.current.toggle());
    expect(result.current.t).toBe(0);
    expect(result.current.playing).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.playing).toBe(false);
  });

  it('seek clamps to [minT, duration] including negative minT', () => {
    const { result } = renderHook(() => usePlayback({ duration: 4, minT: -1.5 }));
    act(() => result.current.seek(-9));
    expect(result.current.t).toBe(-1.5);
    act(() => result.current.seek(99));
    expect(result.current.t).toBe(4);
    act(() => result.current.seek(1.25));
    expect(result.current.t).toBe(1.25);
  });

  it('slower/faster step through PLAYBACK_SPEEDS and clamp at 0.25 and 2', () => {
    const { result } = renderHook(() => usePlayback({ duration: 4 }));
    act(() => result.current.faster());
    expect(result.current.speed).toBe(2);
    act(() => result.current.faster());
    expect(result.current.speed).toBe(2);
    act(() => result.current.slower());
    expect(result.current.speed).toBe(1);
    act(() => result.current.slower());
    act(() => result.current.slower());
    expect(result.current.speed).toBe(0.25);
    act(() => result.current.slower());
    expect(result.current.speed).toBe(0.25);
  });

  it('stepToMark moves to the next / previous mark and is a no-op at the ends', () => {
    const { result } = renderHook(() => usePlayback({ duration: 6 }));
    const marks = [3, 0, 1.5];
    act(() => result.current.stepToMark(1, marks));
    expect(result.current.t).toBe(1.5);
    act(() => result.current.stepToMark(1, marks));
    expect(result.current.t).toBe(3);
    act(() => result.current.stepToMark(1, marks));
    expect(result.current.t).toBe(3);
    act(() => result.current.stepToMark(-1, marks));
    expect(result.current.t).toBe(1.5);
    act(() => result.current.stepToMark(-1, marks));
    expect(result.current.t).toBe(0);
    act(() => result.current.stepToMark(-1, marks));
    expect(result.current.t).toBe(0);
  });

  it('stepToMark treats marks within 1e-6 of t as the current position and keeps playing state', () => {
    const { result } = renderHook(() => usePlayback({ duration: 6 }));
    act(() => result.current.seek(1.5));
    act(() => result.current.stepToMark(1, [1.5 + 1e-7, 2]));
    expect(result.current.t).toBe(2);
    act(() => result.current.play());
    act(() => result.current.stepToMark(-1, [1]));
    expect(result.current.t).toBe(1);
    expect(result.current.playing).toBe(true);
  });

  it('keeps t when duration changes and clamps it into the new range (§9)', () => {
    const { result, rerender } = renderHook(({ d }) => usePlayback({ duration: d }), {
      initialProps: { d: 6 },
    });
    act(() => result.current.seek(4));
    rerender({ d: 8 });
    expect(result.current.t).toBe(4);
    rerender({ d: 3 });
    expect(result.current.t).toBe(3);
    rerender({ d: 8 });
    expect(result.current.t).toBe(3);
  });

  it('autoPlay starts playing on mount', () => {
    const { result } = renderHook(() => usePlayback({ duration: 5, autoPlay: true }));
    expect(result.current.playing).toBe(true);
    advance(500);
    expect(result.current.t).toBeCloseTo(0.5, 6);
  });

  it('pause cancels the rAF loop: no further updates', () => {
    const { result } = renderHook(() => usePlayback({ duration: 10 }));
    act(() => result.current.play());
    advance(1000);
    act(() => result.current.pause());
    expect(callbacks.size).toBe(0);
    const t = result.current.t;
    advance(2000);
    expect(result.current.t).toBe(t);
    expect(result.current.playing).toBe(false);
  });

  it('cancels the loop on unmount', () => {
    const { result, unmount } = renderHook(() => usePlayback({ duration: 10 }));
    act(() => result.current.play());
    expect(callbacks.size).toBe(1);
    unmount();
    expect(callbacks.size).toBe(0);
  });

  it('resuming after a pause does not jump by the paused time', () => {
    const { result } = renderHook(() => usePlayback({ duration: 10 }));
    act(() => result.current.play());
    advance(1000);
    act(() => result.current.pause());
    now += 5000;
    act(() => result.current.play());
    advance(1000);
    expect(result.current.t).toBeCloseTo(2, 6);
  });
});

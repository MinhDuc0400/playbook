import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutoSave } from '../useAutoSave';

type Props = { v: string; enabled?: boolean };

function setup(save: (v: string) => Promise<void>, initial: Props = { v: 'a' }) {
  return renderHook(({ v, enabled }: Props) => useAutoSave(v, save, { enabled }), {
    initialProps: initial,
  });
}

afterEach(cleanup);

describe('FR-DAT-04 useAutoSave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('never saves the initial value', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = setup(save);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(save).not.toHaveBeenCalled();
    expect(result.current.status).toBe('saved');
  });

  it('saves once, 800 ms after the last of several rapid changes (dirty -> saving -> saved)', async () => {
    let resolve!: () => void;
    const save = vi.fn().mockImplementation(
      () =>
        new Promise<void>((r) => {
          resolve = r;
        }),
    );
    const { result, rerender } = setup(save);
    rerender({ v: 'b' });
    expect(result.current.status).toBe('dirty');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    rerender({ v: 'c' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    rerender({ v: 'd' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(799);
    });
    expect(save).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('d');
    expect(result.current.status).toBe('saving');
    await act(async () => {
      resolve();
    });
    expect(result.current.status).toBe('saved');
  });

  it('a change during a save queues exactly one more save of the latest value', async () => {
    const resolvers: Array<() => void> = [];
    const save = vi.fn().mockImplementation(
      () =>
        new Promise<void>((r) => {
          resolvers.push(r);
        }),
    );
    const { result, rerender } = setup(save);
    rerender({ v: 'b' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(save).toHaveBeenCalledTimes(1);
    rerender({ v: 'c' });
    rerender({ v: 'd' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800); // timer fires while the first save is in flight
    });
    expect(save).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolvers[0]!();
    });
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith('d');
    await act(async () => {
      resolvers[1]!();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(save).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('saved');
  });

  it('a rejected save sets status error and flush retries', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('quota')).mockResolvedValue(undefined);
    const { result, rerender } = setup(save);
    rerender({ v: 'b' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(result.current.status).toBe('error');
    await act(async () => {
      await result.current.flush();
    });
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith('b');
    expect(result.current.status).toBe('saved');
  });

  it('flush saves immediately and cancels the timer', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = setup(save);
    rerender({ v: 'b' });
    await act(async () => {
      await result.current.flush();
    });
    expect(save).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('flush is a no-op when nothing is pending', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = setup(save);
    await act(async () => {
      await result.current.flush();
    });
    expect(save).not.toHaveBeenCalled();
  });

  it('NFR-REL-01 visibilitychange(hidden) flushes immediately; visible does not', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { rerender } = setup(save);
    rerender({ v: 'b' });
    const spy = vi.spyOn(document, 'visibilityState', 'get');
    spy.mockReturnValue('visible');
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(save).not.toHaveBeenCalled();
    spy.mockReturnValue('hidden');
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(save).toHaveBeenCalledWith('b');
    spy.mockRestore();
  });

  it('NFR-REL-01 pagehide flushes immediately', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { rerender } = setup(save);
    rerender({ v: 'b' });
    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(save).toHaveBeenCalledWith('b');
  });

  it('unmount with pending changes flushes', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { rerender, unmount } = setup(save);
    rerender({ v: 'b' });
    unmount();
    expect(save).toHaveBeenCalledWith('b');
  });

  it('unmount without pending changes does not save', () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { unmount } = setup(save);
    unmount();
    expect(save).not.toHaveBeenCalled();
  });

  it('enabled:false never saves, not even on flush or unmount', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result, rerender, unmount } = setup(save, { v: 'a', enabled: false });
    rerender({ v: 'b', enabled: false });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
      await result.current.flush();
      window.dispatchEvent(new Event('pagehide'));
    });
    unmount();
    expect(save).not.toHaveBeenCalled();
  });

  it('values loaded while disabled become the baseline (not saved when enabling)', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { rerender } = setup(save, { v: 'a', enabled: false });
    rerender({ v: 'loaded', enabled: false });
    rerender({ v: 'loaded', enabled: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(save).not.toHaveBeenCalled();
    rerender({ v: 'edited', enabled: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(save).toHaveBeenCalledWith('edited');
  });

  it('a new save identity does not reset the timer', async () => {
    const first = vi.fn().mockResolvedValue(undefined);
    const second = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(
      ({ v, s }: { v: string; s: (v: string) => Promise<void> }) => useAutoSave(v, s),
      {
        initialProps: { v: 'a', s: first },
      },
    );
    rerender({ v: 'b', s: first });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    rerender({ v: 'b', s: second });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(second).toHaveBeenCalledWith('b');
    expect(first).not.toHaveBeenCalled();
  });
});

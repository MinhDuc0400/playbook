/**
 * Debounced auto-save (FR-DAT-04) with flush on visibilitychange(hidden) / pagehide (NFR-REL-01).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error';

export interface AutoSave {
  status: SaveStatus;
  /** Save pending changes now (no-op when nothing is pending). */
  flush(): Promise<void>;
}

/**
 * Calls `save(value)` `delay` ms (default 800) after the last change of `value` (compared by reference).
 * The initial value is considered saved. While a save runs, newer values queue one more save.
 * `enabled: false` disables saving (e.g. while loading).
 */
export function useAutoSave<T>(
  value: T,
  save: (v: T) => Promise<void>,
  opts?: { delay?: number; enabled?: boolean },
): AutoSave {
  const delay = opts?.delay ?? 800;
  const enabled = opts?.enabled ?? true;

  const [status, setStatus] = useState<SaveStatus>('saved');
  const valueRef = useRef(value);
  const savedRef = useRef(value); // last value known to be persisted (initial value counts)
  const saveRef = useRef(save);
  const delayRef = useRef(delay);
  const enabledRef = useRef(enabled);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = useRef<Promise<void> | null>(null);
  const queuedRef = useRef(false);

  const clearTimer = useCallback((): void => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const isDirty = useCallback((): boolean => valueRef.current !== savedRef.current, []);

  const start = useCallback((): Promise<void> => {
    const run = (async () => {
      let failed = false;
      do {
        queuedRef.current = false;
        const v = valueRef.current;
        setStatus('saving');
        try {
          await saveRef.current(v);
          savedRef.current = v;
        } catch {
          failed = true;
        }
      } while (!failed && queuedRef.current && isDirty());
      setStatus(failed ? 'error' : isDirty() ? 'dirty' : 'saved');
    })();
    const tracked = run.finally(() => {
      runningRef.current = null;
    });
    runningRef.current = tracked;
    return tracked;
  }, [isDirty]);

  const flush = useCallback((): Promise<void> => {
    clearTimer();
    if (runningRef.current) {
      if (isDirty() && enabledRef.current) queuedRef.current = true;
      return runningRef.current;
    }
    if (!enabledRef.current || !isDirty()) return Promise.resolve();
    return start();
  }, [clearTimer, isDirty, start]);

  const flushRef = useRef(flush);

  useEffect(() => {
    saveRef.current = save;
    delayRef.current = delay;
    flushRef.current = flush;
  });

  // React to value / enabled changes.
  useEffect(() => {
    valueRef.current = value;
    enabledRef.current = enabled;
    if (!enabled) {
      // While disabled (e.g. loading) the latest value is the baseline, never saved.
      clearTimer();
      savedRef.current = value;
      return;
    }
    if (!isDirty()) {
      clearTimer();
      if (!runningRef.current) setStatus('saved');
      return;
    }
    setStatus('dirty');
    clearTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (runningRef.current) queuedRef.current = true;
      else void start();
    }, delayRef.current);
  }, [value, enabled, clearTimer, isDirty, start]);

  // Flush when the tab is hidden or closed (NFR-REL-01); flush on unmount.
  useEffect(() => {
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') void flushRef.current();
    };
    const onPageHide = (): void => {
      void flushRef.current();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      void flushRef.current();
    };
  }, []);

  return { status, flush };
}

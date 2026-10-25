/**
 * Debounced auto-save (FR-DAT-04) with flush on visibilitychange(hidden) / pagehide (NFR-REL-01).
 */
import { notImplemented } from '@/domain/notImplemented';

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
  return notImplemented(`useAutoSave ${String(value)}${String(save)}${String(opts)}`);
}

/** Theme handling (NFR-UX-02): light / dark / system → `dark` class on <html>. */
import { notImplemented } from '@/domain/notImplemented';
import type { ThemePref } from '@/domain/types';

/** Resolve a preference against the system setting. */
export function resolveTheme(pref: ThemePref, systemDark: boolean): 'light' | 'dark' {
  return notImplemented(`resolveTheme ${pref}${systemDark}`);
}

/** React hook: apply the stored preference (useSettings) and follow system changes. */
export function useApplyTheme(): void {
  return notImplemented('useApplyTheme');
}

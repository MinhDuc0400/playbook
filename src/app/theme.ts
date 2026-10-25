/** Theme handling (NFR-UX-02): light / dark / system → `dark` class on <html>. */
import { useEffect } from 'react';
import { useSettings } from '@/db/hooks';
import type { ThemePref } from '@/domain/types';

/** Resolve a preference against the system setting. */
export function resolveTheme(pref: ThemePref, systemDark: boolean): 'light' | 'dark' {
  if (pref === 'system') return systemDark ? 'dark' : 'light';
  return pref;
}

/** React hook: apply the stored preference (useSettings) and follow system changes. */
export function useApplyTheme(): void {
  const settings = useSettings();
  const pref: ThemePref = settings?.ui.theme ?? 'system';

  useEffect(() => {
    const mq =
      typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    const apply = (): void => {
      const dark = resolveTheme(pref, mq?.matches ?? false) === 'dark';
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    if (pref !== 'system' || !mq) return undefined;
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [pref]);
}

/** Media-query hook (D-25). Returns false when matchMedia is unavailable (tests default to desktop). */
import { useEffect, useState } from 'react';

export const DESKTOP_QUERY = '(min-width: 1024px)';

export function useMediaQuery(query: string): boolean {
  const get = (): boolean =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false;
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const onChange = (): void => setMatches(mql.matches);
    onChange();
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, [query]);
  return matches;
}

/** True on desktop widths (≥ 1024 px). Without matchMedia (jsdom) it reports desktop. */
export function useIsDesktop(): boolean {
  const hasMM = typeof window !== 'undefined' && typeof window.matchMedia === 'function';
  const m = useMediaQuery(DESKTOP_QUERY);
  return hasMM ? m : true;
}

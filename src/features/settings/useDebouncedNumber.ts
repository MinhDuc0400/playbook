import { useEffect, useRef, useState } from 'react';

/** Local draft of a numeric setting; commits (debounced) via onCommit, resyncs when the stored value changes. */
export function useDraft(
  value: number,
  onCommit: (v: number) => void,
  delayMs = 300,
): { draft: string; set: (raw: string, immediate?: boolean) => void; revert: () => void } {
  const [draft, setDraft] = useState(String(value));
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const commit = useRef(onCommit);
  commit.current = onCommit;
  useEffect(() => {
    setDraft(String(value));
  }, [value]);
  useEffect(() => () => clearTimeout(timer.current), []);
  return {
    draft,
    set: (raw, immediate = false) => {
      setDraft(raw);
      clearTimeout(timer.current);
      const n = Number(raw);
      if (raw.trim() === '' || !Number.isFinite(n)) return;
      if (immediate) commit.current(n);
      else timer.current = setTimeout(() => commit.current(n), delayMs);
    },
    revert: () => setDraft(String(value)),
  };
}

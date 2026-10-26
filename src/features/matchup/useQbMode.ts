/**
 * "QB tự ném" mode (D-23), UI state only. The sim is re-run by useMatchupSim with `qbOverride`; this file
 * holds the toggle / throw state, the key map and the press-time feedback (all read from engine output).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ID, SimInput, SimResult } from '@/domain/types';
import { frameAt } from '@/engine/frames';

export const QB_KEYS = ['Q', 'W', 'E', 'R', 'T'] as const;

export interface QbKey {
  key: string;
  id: ID;
  label: string;
}

export interface QbTally {
  attempts: number;
  completions: number;
  best: number;
}

export interface QbFeedback {
  targetId: ID;
  label: string;
  t: number;
  score: number | undefined;
  separation: number | undefined;
  /** Highest-scoring receiver at the press (undefined when no scores). */
  best: { id: ID; label: string; score: number } | undefined;
  isBest: boolean;
}

type Slot = { id: ID; label: string; role: string };
export type QbOverride = Pick<SimInput, 'qbControl' | 'manualThrow'>;

/** Receivers in read order (reads.windows), then the remaining non-QB slots; max 5 keys. */
export function buildQbKeyMap(result: SimResult | null, players: readonly Slot[]): QbKey[] {
  const receivers = players.filter((p) => p.role !== 'QB');
  const windowIds = (result?.metrics.reads?.windows ?? [])
    .map((w) => w.id)
    .filter((id) => receivers.some((p) => p.id === id));
  const ids = [...windowIds, ...receivers.map((p) => p.id)].filter((id, i, a) => a.indexOf(id) === i);
  return ids.slice(0, QB_KEYS.length).map((id, i) => ({
    key: QB_KEYS[i]!,
    id,
    label: receivers.find((p) => p.id === id)?.label ?? id,
  }));
}

function sepAt(series: { t: number; d: number }[] | undefined, t: number): number | undefined {
  let found: number | undefined;
  for (const e of series ?? []) {
    if (e.t > t) break;
    found = e.d;
  }
  return found;
}

/** Press-time feedback: read score, separation and the best alternative at `t`. */
export function qbFeedback(
  result: SimResult,
  keyMap: readonly QbKey[],
  throwAt: { targetId: ID; t: number },
): QbFeedback {
  const scores = frameAt(result.frames, throwAt.t)?.qb?.scores ?? {};
  const label = keyMap.find((k) => k.id === throwAt.targetId)?.label ?? throwAt.targetId;
  const score = scores[throwAt.targetId];
  let best: QbFeedback['best'];
  for (const k of keyMap) {
    const v = scores[k.id];
    if (v !== undefined && (best === undefined || v > best.score))
      best = { id: k.id, label: k.label, score: v };
  }
  return {
    targetId: throwAt.targetId,
    label,
    t: throwAt.t,
    score,
    separation: sepAt(result.metrics.separation[throwAt.targetId], throwAt.t),
    best,
    isBest: score !== undefined && best !== undefined && score >= best.score,
  };
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  // A focused checkbox / radio / range (e.g. the mode toggle just clicked) is not text entry.
  if (target instanceof HTMLInputElement && ['checkbox', 'radio', 'range', 'button'].includes(target.type)) {
    return false;
  }
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

export interface QbModeState {
  enabled: boolean;
  /** The user's throw, or null before it. */
  manualThrow: { targetId: ID; t: number } | null;
  /** Memoized override for useMatchupSim; undefined when the mode is off. */
  override: QbOverride | undefined;
  tally: QbTally;
  enable(): void;
  disable(): void;
  /** Records the throw (ignored when already thrown / disabled). */
  throwTo(targetId: ID, t: number): void;
  retry(): void;
  /** Called by the page with the re-run result so the tally counts each throw once. */
  record(result: SimResult | null, keyMap: readonly QbKey[]): void;
}

export function useQbModeState(): QbModeState {
  const [enabled, setEnabled] = useState(false);
  const [manualThrow, setManualThrow] = useState<{ targetId: ID; t: number } | null>(null);
  const [seq, setSeq] = useState(0);
  const [tally, setTally] = useState<QbTally>({ attempts: 0, completions: 0, best: 0 });
  const counted = useRef(0);
  const thrown = useRef(false);

  const override = useMemo<QbOverride | undefined>(
    () => (enabled ? { qbControl: 'manual', ...(manualThrow ? { manualThrow } : {}) } : undefined),
    [enabled, manualThrow],
  );

  const enable = useCallback(() => {
    thrown.current = false;
    setManualThrow(null);
    setEnabled(true);
  }, []);
  const disable = useCallback(() => {
    thrown.current = false;
    setManualThrow(null);
    setEnabled(false);
  }, []);
  const throwTo = useCallback((targetId: ID, t: number) => {
    if (thrown.current) return;
    thrown.current = true;
    setManualThrow({ targetId, t });
    setSeq((n) => n + 1);
  }, []);
  const retry = useCallback(() => {
    thrown.current = false;
    setManualThrow(null);
  }, []);

  const record = useCallback(
    (result: SimResult | null, keyMap: readonly QbKey[]) => {
      if (!manualThrow || !result || seq === counted.current) return;
      if (result.metrics.reads?.decision.kind !== 'manual') return;
      counted.current = seq;
      const fb = qbFeedback(result, keyMap, manualThrow);
      setTally((t0) => ({
        attempts: t0.attempts + 1,
        completions: t0.completions + (result.outcome.kind === 'complete' ? 1 : 0),
        best: t0.best + (fb.isBest ? 1 : 0),
      }));
    },
    [manualThrow, seq],
  );

  return { enabled, manualThrow, override, tally, enable, disable, throwTo, retry, record };
}

/** Window keydown for the key map. Ignored in inputs, with modifiers and on auto-repeat. */
export function useQbKeys(active: boolean, keyMap: readonly QbKey[], onPick: (id: ID) => void): void {
  const ref = useRef({ keyMap, onPick });
  useEffect(() => {
    ref.current = { keyMap, onPick };
  });
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (isTypingTarget(e.target)) return;
      const hit = ref.current.keyMap.find((k) => k.key === e.key.toUpperCase());
      if (!hit) return;
      e.preventDefault();
      ref.current.onPick(hit.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);
}

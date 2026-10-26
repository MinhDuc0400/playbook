/** FR-ATH-01 / FR-MU-09: selected player → Kém / TB / Hay buttons writing Matchup.overrides; keys 1/2/3. */
import { useEffect } from 'react';
import { classifyStats, resolveStats } from '@/domain/stats';
import type { DbSnapshot, Matchup, Preset } from '@/domain/types';
import { t } from '@/i18n/vi';
import { useMatchupStore } from '@/store/matchupStore';
import { setOverridePreset, type BuiltSim } from './buildSimInput';

export interface PlayerPanelProps {
  matchup: Matchup;
  built: BuiltSim;
  snapshot: DbSnapshot;
  onChange(m: Matchup): void;
}

const BUTTONS: { preset: Preset; testId: string; key: string }[] = [
  { preset: 'weak', testId: 'level-weak', key: '1' },
  { preset: 'avg', testId: 'level-avg', key: '2' },
  { preset: 'good', testId: 'level-good', key: '3' },
];

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

export function PlayerPanel({ matchup, built, snapshot, onChange }: PlayerPanelProps): JSX.Element {
  const selected = useMatchupStore((s) => s.selected);

  useEffect(() => {
    if (!selected) return undefined;
    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      const hit = BUTTONS.find((b) => b.key === e.key);
      if (hit) onChange(setOverridePreset(matchup, selected.side, selected.label, hit.preset));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, matchup, onChange]);

  // `built` is part of the contract (slot lookup for the selection); the label is what overrides key on.
  const slot = selected
    ? (selected.side === 'offense' ? built.offense : built.defense).players.find(
        (p) => p.id === selected.slotId,
      )
    : undefined;

  if (!selected) {
    return (
      <aside data-testid="player-panel" className="p-3 text-sm text-slate-600 dark:text-slate-300">
        <p data-testid="player-panel-hint">{t.matchupField.panel.hint}</p>
      </aside>
    );
  }

  const current = classifyStats(
    resolveStats(matchup, selected.side, selected.label, snapshot),
    snapshot.settings.presets,
  );

  return (
    <aside data-testid="player-panel" className="flex flex-col gap-3 p-3 text-sm">
      <h3 className="font-semibold" data-testid="player-panel-title">
        {t.matchupField.panel.title} {slot?.label ?? selected.label}
      </h3>
      <p className="text-slate-600 dark:text-slate-300" data-testid="player-panel-side">
        {selected.side === 'offense' ? t.matchupField.panel.sideOffense : t.matchupField.panel.sideDefense}
      </p>
      <div role="group" aria-label={t.matchupField.panel.level} className="flex gap-2">
        {BUTTONS.map((b) => (
          <button
            key={b.preset}
            type="button"
            data-testid={b.testId}
            aria-pressed={current === b.preset}
            onClick={() => onChange(setOverridePreset(matchup, selected.side, selected.label, b.preset))}
            className="min-h-11 flex-1 rounded-md border border-slate-300 px-3 py-2 aria-pressed:border-blue-600 aria-pressed:bg-blue-600 aria-pressed:text-white dark:border-slate-600"
          >
            {t.matchupField.levels[b.preset]}
          </button>
        ))}
      </div>
      {current === 'custom' && (
        <p className="text-xs text-purple-700 dark:text-purple-300" data-testid="player-panel-custom">
          {t.matchupField.levels.custom}
        </p>
      )}
      <p className="text-xs text-slate-500">{t.matchupField.panel.keysHint}</p>
    </aside>
  );
}

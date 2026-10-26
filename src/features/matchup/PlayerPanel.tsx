/** FR-ATH-01 / FR-MU-09: selected player → Kém / TB / Hay buttons writing Matchup.overrides; keys 1/2/3. */
import { useEffect, useState } from 'react';
import { classifyStats, resolveStats } from '@/domain/stats';
import { STAT_KEYS } from '@/domain/types';
import type { DbSnapshot, Matchup, Preset, Side, Stats, StatOverride } from '@/domain/types';
import { STAT_RANGES } from '@/features/roster/statRanges';
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

/** FR-ATH-03: write one per-stat override for (side, label); keeps the preset override. */
function setOverrideStat(m: Matchup, side: Side, label: string, key: keyof Stats, value: number): Matchup {
  const exists = m.overrides.some((o) => o.side === side && o.label === label);
  const overrides = exists
    ? m.overrides.map((o) =>
        o.side === side && o.label === label ? { ...o, stats: { ...o.stats, [key]: value } } : o,
      )
    : [...m.overrides, { side, label, stats: { [key]: value } }];
  return { ...m, overrides };
}

/** FR-ATH-03 "Về preset": drop the per-stat overrides, keep the preset override. */
function resetOverrideStats(m: Matchup, side: Side, label: string): Matchup {
  const overrides: StatOverride[] = [];
  for (const o of m.overrides) {
    if (o.side !== side || o.label !== label) {
      overrides.push(o);
    } else if (o.preset !== undefined) {
      overrides.push({ side: o.side, label: o.label, preset: o.preset });
    }
  }
  return { ...m, overrides };
}

function StatRow({
  statKey,
  value,
  onValid,
}: {
  statKey: keyof Stats;
  value: number;
  onValid(v: number): void;
}): JSX.Element {
  const { min, max } = STAT_RANGES[statKey];
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    setDraft((d) => (d.trim() !== '' && Number(d) === value ? d : String(value)));
  }, [value]);
  const label = t.matchupField.statNames[statKey];
  const apply = (text: string): void => {
    setDraft(text);
    const n = text.trim() === '' ? NaN : Number(text);
    if (Number.isFinite(n) && n >= min && n <= max) onValid(n);
  };
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="range"
          aria-label={label}
          data-testid={`player-stat-${statKey}`}
          min={min}
          max={max}
          step={0.01}
          value={value}
          onChange={(e) => apply(e.target.value)}
          className="flex-1"
        />
        <input
          type="number"
          aria-label={`${label} (số)`}
          data-testid={`player-stat-${statKey}-num`}
          min={min}
          max={max}
          step={0.01}
          value={draft}
          onChange={(e) => apply(e.target.value)}
          onBlur={() => setDraft(String(value))}
          className="w-20 rounded-md border border-slate-300 bg-white px-1 py-0.5 dark:border-slate-600 dark:bg-slate-800"
        />
      </div>
    </div>
  );
}

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

  const resolved = resolveStats(matchup, selected.side, selected.label, snapshot);
  const current = classifyStats(resolved, snapshot.settings.presets);

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
      <details data-testid="player-advanced" className="rounded border p-2">
        <summary className="cursor-pointer font-medium">{t.matchupField.panel.advanced}</summary>
        <div className="mt-2 flex flex-col gap-2">
          {STAT_KEYS.map((k) => (
            <StatRow
              key={k}
              statKey={k}
              value={resolved[k]}
              onValid={(v) => onChange(setOverrideStat(matchup, selected.side, selected.label, k, v))}
            />
          ))}
          <button
            type="button"
            data-testid="player-reset"
            onClick={() => onChange(resetOverrideStats(matchup, selected.side, selected.label))}
            className="min-h-11 rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600"
          >
            {t.matchupField.panel.resetToPreset}
          </button>
        </div>
      </details>
    </aside>
  );
}

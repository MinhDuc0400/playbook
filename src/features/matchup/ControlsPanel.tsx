/** Matchup parameter controls (FR-MU-02). Every change re-simulates through the working matchup. */
import { useEffect, useState } from 'react';
import { IconButton, Select } from '@/components/ui';
import { useFeatures } from '@/config/features';
import { useLineups } from '@/db/hooks';
import type { Format, Matchup, Side } from '@/domain/types';
import { t } from '@/i18n/vi';
import { randomSeed } from './buildSimInput';

export interface ControlsPanelProps {
  matchup: Matchup;
  /** Format of the matchup's plays; lineups are filtered by it when given. */
  format?: Format;
  onChange(m: Matchup): void;
}

const s = t.matchup.controls;

interface NumberFieldProps {
  label: string;
  testId: string;
  value: number;
  min: number;
  max: number;
  step: number;
  integer?: boolean;
  onValid(v: number): void;
}

/** Number input with a local draft: only valid, in-range values are applied. */
function NumberField({
  label,
  testId,
  value,
  min,
  max,
  step,
  integer,
  onValid,
}: NumberFieldProps): JSX.Element {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    setDraft((d) => (d.trim() !== '' && Number(d) === value ? d : String(value)));
  }, [value]);
  const parsed = draft.trim() === '' ? NaN : Number(draft);
  const valid =
    Number.isFinite(parsed) && parsed >= min && parsed <= max && (!integer || Number.isInteger(parsed));
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
      {label}
      <input
        type="number"
        data-testid={testId}
        value={draft}
        min={min}
        max={max}
        step={step}
        aria-invalid={!valid}
        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        onChange={(e) => {
          const text = e.target.value;
          setDraft(text);
          const n = text.trim() === '' ? NaN : Number(text);
          if (Number.isFinite(n) && n >= min && n <= max && (!integer || Number.isInteger(n))) onValid(n);
        }}
        onBlur={() => {
          if (!valid) setDraft(String(value));
        }}
      />
    </label>
  );
}

export function ControlsPanel({ matchup, format, onChange }: ControlsPanelProps): JSX.Element {
  const features = useFeatures();
  const lineups = useLineups();
  const lineupSelect = (side: Side): JSX.Element => {
    const key = side === 'offense' ? 'offenseLineupId' : 'defenseLineupId';
    const options = (lineups ?? []).filter(
      (l) => l.side === side && (format === undefined || l.format === format),
    );
    return (
      <Select
        label={side === 'offense' ? s.lineupOffense : s.lineupDefense}
        data-testid={`ctl-lineup-${side}`}
        value={matchup[key] ?? ''}
        onChange={(e) => {
          const next = { ...matchup };
          if (e.target.value === '') delete next[key];
          else next[key] = e.target.value;
          onChange(next);
        }}
      >
        <option value="">{s.lineupNone}</option>
        {options.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </Select>
    );
  };
  return (
    <section data-testid="controls-panel" className="flex flex-col gap-3 rounded border p-3 text-sm">
      <h2 className="font-semibold">{s.title}</h2>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          data-testid="ctl-offense-flipped"
          checked={matchup.offenseFlipped}
          onChange={(e) => onChange({ ...matchup, offenseFlipped: e.target.checked })}
        />
        {s.offenseFlipped}
      </label>
      <Select
        label={s.defenseFlip}
        data-testid="ctl-defense-flip"
        value={matchup.defenseFlip}
        onChange={(e) => onChange({ ...matchup, defenseFlip: e.target.value as Matchup['defenseFlip'] })}
      >
        {(['auto', 'none', 'flip'] as const).map((v) => (
          <option key={v} value={v}>
            {s.defenseFlipOptions[v]}
          </option>
        ))}
      </Select>
      {features.showStats && lineupSelect('offense')}
      {features.showStats && lineupSelect('defense')}
      {features.showMatchupTuning && (
        <>
          <NumberField
            label={s.ballX}
            testId="ctl-ball-x"
            value={matchup.ballSpot.x}
            min={-10}
            max={10}
            step={0.5}
            onValid={(x) => onChange({ ...matchup, ballSpot: { ...matchup.ballSpot, x } })}
          />
          <NumberField
            label={s.ballYardLine}
            testId="ctl-ball-yardline"
            value={matchup.ballSpot.yardLine}
            min={1}
            max={49}
            step={1}
            integer
            onValid={(yardLine) => onChange({ ...matchup, ballSpot: { ...matchup.ballSpot, yardLine } })}
          />
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <NumberField
                label={s.seed}
                testId="ctl-seed"
                value={matchup.seed}
                min={0}
                max={2 ** 31 - 1}
                step={1}
                integer
                onValid={(seed) => onChange({ ...matchup, seed })}
              />
            </div>
            <IconButton
              data-testid="ctl-seed-dice"
              label={s.seedDice}
              onClick={() => onChange({ ...matchup, seed: randomSeed() })}
            >
              🎲
            </IconButton>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="ctl-anticipation" className="font-medium text-slate-700 dark:text-slate-200">
              {s.anticipation}: {matchup.anticipation.toFixed(2)}
            </label>
            <input
              id="ctl-anticipation"
              type="range"
              data-testid="ctl-anticipation"
              list="ctl-anticipation-ticks"
              min={0}
              max={1}
              step={0.05}
              value={matchup.anticipation}
              onChange={(e) => onChange({ ...matchup, anticipation: Number(e.target.value) })}
            />
            <datalist id="ctl-anticipation-ticks">
              <option value="0" label={s.anticipationTicks.low} />
              <option value="0.5" label={s.anticipationTicks.mid} />
              <option value="1" label={s.anticipationTicks.high} />
            </datalist>
            <div
              aria-hidden="true"
              className="flex justify-between text-xs text-slate-600 dark:text-slate-300"
            >
              <span>{s.anticipationTicks.low}</span>
              <span>{s.anticipationTicks.mid}</span>
              <span>{s.anticipationTicks.high}</span>
            </div>
            {matchup.anticipation > 0.5 && (
              <p
                data-testid="ctl-oracle-label"
                role="status"
                className="rounded border border-amber-500 bg-amber-100 px-2 py-1 text-xs font-bold text-amber-900 dark:bg-amber-900 dark:text-amber-100"
              >
                {s.oracle}
              </p>
            )}
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              data-testid="ctl-noise"
              checked={matchup.noise}
              onChange={(e) => onChange({ ...matchup, noise: e.target.checked })}
            />
            {s.noise}
          </label>
        </>
      )}
    </section>
  );
}
